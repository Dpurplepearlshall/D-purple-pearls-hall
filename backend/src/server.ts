import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool, query } from './db.js';
import { authenticate, comparePassword, hashPassword, issueToken, requireRole } from './auth.js';
import { errorHandler, notFound } from './middleware.js';
import { changePasswordSchema, loginSchema, newsSchema, ownerPasswordResetSchema, registrationSchema, resultSchema, schoolCalendarSchema, studentSchema, teacherRegistrationSchema, teacherSchema } from './validation.js';

const app = express();
app.use(cors({ origin: config.frontendUrl, credentials: false }));
app.use(express.json({ limit: '1mb' }));

const nigeriaClasses = ['Nursery 1', 'Nursery 2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3', 'Graduated'];
let promotionCheckYear: number | null = null;
let promotionCheck: Promise<void> | null = null;

async function promoteStudentsIfDue() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  if (month < 9 || promotionCheckYear === year) return;
  if (promotionCheck) return promotionCheck;
  promotionCheck = (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM school_calendar WHERE id = TRUE FOR UPDATE');
      const setting = await client.query<{ promotion_year: number | null }>('SELECT promotion_year FROM school_calendar WHERE id = TRUE');
      if (setting.rows[0]?.promotion_year !== year) {
        await client.query(
          `UPDATE allowed_students
           SET current_class = CASE current_class
             WHEN 'Nursery 1' THEN 'Nursery 2' WHEN 'Nursery 2' THEN 'Primary 1'
             WHEN 'Primary 1' THEN 'Primary 2' WHEN 'Primary 2' THEN 'Primary 3'
             WHEN 'Primary 3' THEN 'Primary 4' WHEN 'Primary 4' THEN 'Primary 5'
             WHEN 'Primary 5' THEN 'Primary 6' WHEN 'Primary 6' THEN 'JSS 1'
             WHEN 'JSS 1' THEN 'JSS 2' WHEN 'JSS 2' THEN 'JSS 3'
             WHEN 'JSS 3' THEN 'SS 1' WHEN 'SS 1' THEN 'SS 2'
             WHEN 'SS 2' THEN 'SS 3' WHEN 'SS 3' THEN 'Graduated'
             ELSE current_class END
           WHERE current_class = ANY($1::varchar[])`,
          [nigeriaClasses]
        );
        await client.query('UPDATE school_calendar SET promotion_year = $1 WHERE id = TRUE', [year]);
      }
      await client.query('COMMIT');
      promotionCheckYear = year;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })().finally(() => { promotionCheck = null; });
  return promotionCheck;
}

app.use(async (_req, _res, next) => {
  try { await promoteStudentsIfDue(); next(); } catch (error) { next(error); }
});

async function logActivity(userId: string | null, event: string, metadata: Record<string, unknown> = {}) {
  await query('INSERT INTO activity_logs (user_id, event, metadata) VALUES ($1, $2, $3)', [
    userId,
    event,
    JSON.stringify(metadata)
  ]);
}

function csvCell(value: unknown) {
  let text = value instanceof Date ? value.toISOString() : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/home', async (_req, res, next) => {
  try {
    const [news, calendar] = await Promise.all([
      query('SELECT id, heading, body, created_at FROM school_news ORDER BY created_at DESC LIMIT 50'),
      query('SELECT vacation_date, results_release_date, resumption_date FROM school_calendar WHERE id = TRUE')
    ]);
    res.json({ news: news.rows, calendar: calendar.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/owner/news', authenticate, requireRole('owner'), async (_req, res, next) => {
  try { res.json({ news: (await query('SELECT id, heading, body, created_at FROM school_news ORDER BY created_at DESC')).rows }); }
  catch (error) { next(error); }
});

app.post('/api/owner/news', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = newsSchema.parse(req.body);
    const news = await query('INSERT INTO school_news (heading, body) VALUES ($1, $2) RETURNING id, heading, body, created_at', [input.heading, input.body]);
    res.status(201).json({ news: news.rows[0] });
  } catch (error) { next(error); }
});

app.delete('/api/owner/news/:id', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM school_news WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rowCount) { res.status(404).json({ error: 'News post not found.' }); return; }
    res.json({ message: 'News post removed.' });
  } catch (error) { next(error); }
});

app.get('/api/owner/calendar', authenticate, requireRole('owner'), async (_req, res, next) => {
  try { res.json({ calendar: (await query('SELECT vacation_date, results_release_date, resumption_date FROM school_calendar WHERE id = TRUE')).rows[0] }); }
  catch (error) { next(error); }
});

app.put('/api/owner/calendar', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = schoolCalendarSchema.parse(req.body);
    const result = await query(
      `UPDATE school_calendar SET vacation_date = $1, results_release_date = $2, resumption_date = $3
       WHERE id = TRUE RETURNING vacation_date, results_release_date, resumption_date`,
      [input.vacationDate, input.resultsReleaseDate, input.resumptionDate]
    );
    res.json({ calendar: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/auth/register/student', async (req, res, next) => {
  try {
    const input = registrationSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const allowed = await client.query<{ id: string; name: string; active: boolean }>(
        'SELECT id, name, active FROM allowed_students WHERE admission_number = $1 FOR UPDATE',
        [input.admissionNumber]
      );
      if (!allowed.rowCount || !allowed.rows[0].active) {
        await client.query('ROLLBACK');
        res.status(403).json({ error: 'This admission number is not active on the whitelist. Please contact the owner.' });
        return;
      }
      const existing = await client.query('SELECT id FROM users WHERE student_id = $1', [allowed.rows[0].id]);
      if (existing.rowCount) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'An account already exists for this school ID.' });
        return;
      }
      const passwordHash = await hashPassword(input.password);
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (username, email, password_hash, role, display_name, student_id)
         VALUES ($1, $2, $3, 'student', $4, $5) RETURNING id`,
        [input.admissionNumber, input.email, passwordHash, allowed.rows[0].name, allowed.rows[0].id]
      );
      await client.query('COMMIT');
      await logActivity(user.rows[0].id, 'student_registered', { admissionNumber: input.admissionNumber });
      res.status(201).json({ message: 'Registration successful. You can now log in.' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register/teacher', async (req, res, next) => {
  try {
    const input = teacherRegistrationSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const allowed = await client.query<{ id: string; name: string; active: boolean }>(
        'SELECT id, name, active FROM allowed_teachers WHERE teacher_id = $1 FOR UPDATE', [input.teacherId]
      );
      if (!allowed.rowCount || !allowed.rows[0].active) {
        await client.query('ROLLBACK');
        res.status(403).json({ error: 'This teacher ID is not active on the whitelist. Please contact the owner.' });
        return;
      }
      const existing = await client.query('SELECT id FROM users WHERE teacher_id = $1', [allowed.rows[0].id]);
      if (existing.rowCount) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'An account already exists for this school ID.' });
        return;
      }
      const passwordHash = await hashPassword(input.password);
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (username, email, password_hash, role, display_name, teacher_id)
         VALUES ($1, $2, $3, 'teacher', $4, $5) RETURNING id`,
        [input.teacherId, input.email, passwordHash, allowed.rows[0].name, allowed.rows[0].id]
      );
      await client.query('COMMIT');
      await logActivity(user.rows[0].id, 'teacher_registered', { teacherId: input.teacherId });
      res.status(201).json({ message: 'Registration successful. You can now log in.' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await query<{ id: string; username: string; password_hash: string; role: 'owner' | 'student' | 'teacher'; display_name: string; active: boolean }>(
      `SELECT u.id, u.username, u.password_hash, u.role, u.display_name,
              CASE WHEN u.role = 'student' THEN COALESCE(s.active, false)
                   WHEN u.role = 'teacher' THEN COALESCE(t.active, false)
                   ELSE true END AS active
       FROM users u
       LEFT JOIN allowed_students s ON s.id = u.student_id
       LEFT JOIN allowed_teachers t ON t.id = u.teacher_id
       WHERE lower(u.username) = lower($1)`,
      [input.identifier]
    );
    const user = result.rows[0];
    if (!user || !user.active || !(await comparePassword(input.password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials, or this account is inactive. Please contact the owner.' });
      return;
    }
    const authUser = { id: user.id, email: user.username, role: user.role, displayName: user.display_name };
    await logActivity(user.id, 'login', { role: user.role });
    res.json({ token: issueToken(authUser), user: authUser });
  } catch (error) {
    next(error);
  }
});

app.get('/api/me', authenticate, (req, res) => res.json({ user: req.user }));

app.post('/api/owner/password', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const owner = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1 AND role = \'owner\'', [req.user!.id]);
    if (!owner.rowCount || !(await comparePassword(input.currentPassword, owner.rows[0].password_hash))) {
      res.status(401).json({ error: 'The current password is incorrect.' });
      return;
    }
    if (input.currentPassword === input.newPassword) {
      res.status(400).json({ error: 'The new password must be different from the current password.' });
      return;
    }
    await query('UPDATE users SET password_hash = $1 WHERE id = $2 AND role = \'owner\'', [await hashPassword(input.newPassword), req.user!.id]);
    await logActivity(req.user!.id, 'owner_password_changed');
    res.json({ message: 'Owner password changed successfully.' });
  } catch (error) { next(error); }
});

app.post('/api/owner/accounts/reset-password', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = ownerPasswordResetSchema.parse(req.body);
    const account = input.role === 'student'
      ? await query<{ id: string }>(
        `SELECT u.id FROM allowed_students s
         JOIN users u ON u.student_id = s.id
         WHERE s.admission_number = $1 AND s.active = true AND u.role = 'student'`,
        [input.schoolId]
      )
      : await query<{ id: string }>(
        `SELECT u.id FROM allowed_teachers t
         JOIN users u ON u.teacher_id = t.id
         WHERE t.teacher_id = $1 AND t.active = true AND u.role = 'teacher'`,
        [input.schoolId]
      );
    if (!account.rowCount) {
      res.status(404).json({ error: 'No active registered account matches that school ID.' });
      return;
    }
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      await hashPassword(input.temporaryPassword),
      account.rows[0].id
    ]);
    await logActivity(req.user!.id, 'owner_password_reset', { role: input.role, schoolId: input.schoolId });
    res.json({ message: `Password reset for ${input.schoolId}. Share the replacement password with the account holder securely.` });
  } catch (error) { next(error); }
});

app.get('/api/owner/students', authenticate, requireRole('owner'), async (_req, res, next) => {
  try {
    const result = await query('SELECT id, admission_number, name, active, current_class, created_at FROM allowed_students ORDER BY current_class, name');
    res.json({ students: result.rows });
  } catch (error) { next(error); }
});

app.post('/api/owner/students', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = studentSchema.parse(req.body);
    const result = await query(
      `INSERT INTO allowed_students (admission_number, name, current_class) VALUES ($1, $2, $3)
       ON CONFLICT (admission_number) DO UPDATE SET name = EXCLUDED.name, current_class = EXCLUDED.current_class, active = true
       RETURNING id, admission_number, name, active, current_class, created_at`,
      [input.admissionNumber, input.name, input.currentClass]
    );
    res.status(201).json({ student: result.rows[0] });
  } catch (error) { next(error); }
});

app.delete('/api/owner/students/:id', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const result = await query<{ id: string }>(
      'UPDATE allowed_students SET active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) { res.status(404).json({ error: 'Student not found.' }); return; }
    await query('DELETE FROM users WHERE student_id = $1', [req.params.id]);
    res.json({ message: 'Student marked inactive and login removed.' });
  } catch (error) { next(error); }
});

app.get('/api/owner/teachers', authenticate, requireRole('owner'), async (_req, res, next) => {
  try {
    const result = await query('SELECT id, teacher_id, name, active, created_at FROM allowed_teachers ORDER BY created_at DESC');
    res.json({ teachers: result.rows });
  } catch (error) { next(error); }
});

app.post('/api/owner/teachers', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = teacherSchema.parse(req.body);
    const result = await query(
      `INSERT INTO allowed_teachers (teacher_id, name) VALUES ($1, $2)
       ON CONFLICT (teacher_id) DO UPDATE SET name = EXCLUDED.name, active = true
       RETURNING id, teacher_id, name, active, created_at`,
      [input.teacherId, input.name]
    );
    res.status(201).json({ teacher: result.rows[0] });
  } catch (error) { next(error); }
});

app.delete('/api/owner/teachers/:id', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const result = await query<{ id: string }>(
      'UPDATE allowed_teachers SET active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) { res.status(404).json({ error: 'Teacher not found.' }); return; }
    await query('DELETE FROM users WHERE teacher_id = $1', [req.params.id]);
    res.json({ message: 'Teacher marked inactive and login removed.' });
  } catch (error) { next(error); }
});

app.get('/api/owner/activity', authenticate, requireRole('owner'), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT a.id, a.event, a.metadata, a.created_at, u.username, u.display_name, u.role
       FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.event IN ('login', 'result_uploaded')
       ORDER BY a.created_at DESC LIMIT 200`
    );
    res.json({ activity: result.rows });
  } catch (error) { next(error); }
});

app.get('/api/owner/exports/:dataset', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const datasets = {
      students: {
        filename: 'students.csv',
        headers: ['admission_number', 'name', 'current_class', 'active', 'created_at'],
        sql: 'SELECT admission_number, name, current_class, active, created_at FROM allowed_students ORDER BY current_class, name'
      },
      teachers: {
        filename: 'teachers.csv',
        headers: ['teacher_id', 'name', 'active', 'created_at'],
        sql: 'SELECT teacher_id, name, active, created_at FROM allowed_teachers ORDER BY name'
      },
      results: {
        filename: 'results.csv',
        headers: ['admission_number', 'student_name', 'class_name', 'term', 'subject', 'score', 'created_at'],
        sql: `SELECT s.admission_number, s.name AS student_name, r.class_name, r.term, r.subject, r.score, r.created_at
              FROM results r JOIN allowed_students s ON s.id = r.student_id
              ORDER BY s.admission_number, r.term, r.created_at`
      },
      activity: {
        filename: 'activity.csv',
        headers: ['event', 'username', 'display_name', 'role', 'metadata', 'created_at'],
        sql: `SELECT a.event, u.username, u.display_name, u.role, a.metadata, a.created_at
              FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
              ORDER BY a.created_at DESC`
      }
    } as const;
    const requestedDataset = req.params.dataset;
    if (typeof requestedDataset !== 'string' || !Object.prototype.hasOwnProperty.call(datasets, requestedDataset)) {
      res.status(404).json({ error: 'Unknown export. Choose students, teachers, results, or activity.' });
      return;
    }
    const dataset = datasets[requestedDataset as keyof typeof datasets];
    const rows = await query(dataset.sql);
    res.set('Cache-Control', 'no-store');
    res.attachment(dataset.filename).type('text/csv').send(toCsv([...dataset.headers], rows.rows));
  } catch (error) { next(error); }
});

app.get('/api/owner/backup', authenticate, requireRole('owner'), async (_req, res, next) => {
  try {
    const [students, teachers, results, news, calendar, activity] = await Promise.all([
      query('SELECT admission_number, name, current_class, active, created_at FROM allowed_students ORDER BY admission_number'),
      query('SELECT teacher_id, name, active, created_at FROM allowed_teachers ORDER BY teacher_id'),
      query(`SELECT s.admission_number, s.name AS student_name, r.class_name, r.term, r.subject, r.score, r.created_at
             FROM results r JOIN allowed_students s ON s.id = r.student_id
             ORDER BY s.admission_number, r.term, r.created_at`),
      query('SELECT heading, body, created_at FROM school_news ORDER BY created_at'),
      query('SELECT vacation_date, results_release_date, resumption_date, promotion_year FROM school_calendar WHERE id = TRUE'),
      query(`SELECT a.event, a.metadata, a.created_at, u.username, u.display_name, u.role
             FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at`)
    ]);
    res.set('Cache-Control', 'no-store').attachment('school-portal-backup.json').json({
      exportedAt: new Date().toISOString(),
      note: 'This data backup intentionally excludes passwords, password hashes, tokens, and login credentials.',
      students: students.rows,
      teachers: teachers.rows,
      results: results.rows,
      news: news.rows,
      calendar: calendar.rows[0] ?? null,
      activity: activity.rows
    });
  } catch (error) { next(error); }
});

const rankingQuery = `
  WITH averages AS (
    SELECT r.term, s.id AS student_id, s.admission_number, s.name,
           AVG(r.score)::numeric(7,2) AS average
    FROM results r
    JOIN allowed_students s ON s.id = r.student_id
    WHERE r.term IS NOT NULL
    GROUP BY r.term, s.id, s.admission_number, s.name
  )
  SELECT term, student_id, admission_number, name, average,
         RANK() OVER (PARTITION BY term ORDER BY average DESC)::int AS rank,
         COUNT(*) OVER (PARTITION BY term)::int AS total_students
  FROM averages
  ORDER BY term, rank, admission_number
`;

app.post('/api/results', authenticate, requireRole('teacher', 'owner'), async (req, res, next) => {
  try {
    const input = resultSchema.parse(req.body);
    const student = await query<{ id: string }>(
      'SELECT id FROM allowed_students WHERE admission_number = $1 AND active = true',
      [input.studentAdmissionNumber]
    );
    if (!student.rowCount) {
      res.status(404).json({ error: 'Student is not active on the whitelist.' });
      return;
    }
    const result = await query<{ id: string; created_at: string }>(
      `INSERT INTO results (student_id, class_name, term, subject, score, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [student.rows[0].id, input.className, input.term, input.subject, input.score, req.user!.id]
    );
    await logActivity(req.user!.id, 'result_uploaded', {
      studentAdmissionNumber: input.studentAdmissionNumber, className: input.className,
      term: input.term, subject: input.subject, score: input.score
    });
    res.status(201).json({ result: result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/results/me', authenticate, requireRole('student'), async (req, res, next) => {
  try {
    const account = await query<{ student_id: string }>('SELECT student_id FROM users WHERE id = $1', [req.user!.id]);
    if (!account.rowCount || !account.rows[0].student_id) {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }
    const result = await query<{ id: string; term: string; class_name: string; subject: string; score: number; created_at: string }>(
      `SELECT r.id, COALESCE(r.term, 'Unassigned') AS term, COALESCE(r.class_name, 'Unassigned') AS class_name,
              r.subject, r.score, r.created_at
       FROM results r
       JOIN users u ON u.student_id = r.student_id
       WHERE u.id = $1
       ORDER BY COALESCE(r.term, 'Unassigned'), r.created_at ASC
       LIMIT 200`,
      [req.user!.id]
    );
    const rankings = await query<{ term: string; student_id: string; average: number; rank: number; total_students: number }>(
      rankingQuery
    );
    const summaries = rankings.rows
      .filter((ranking) => ranking.student_id === account.rows[0].student_id)
      .map(({ term, average, rank, total_students }) => ({ term, average, rank, totalStudents: total_students }));
    res.json({ results: result.rows, summaries });
  } catch (error) { next(error); }
});

app.get('/api/owner/students/:id/results', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const student = await query<{ id: string; admission_number: string; name: string; active: boolean; created_at: string }>(
      'SELECT id, admission_number, name, active, created_at FROM allowed_students WHERE id = $1',
      [req.params.id]
    );
    if (!student.rowCount) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const results = await query<{ id: string; term: string; class_name: string; subject: string; score: number; created_at: string }>(
      `SELECT r.id, COALESCE(r.term, 'Unassigned') AS term, COALESCE(r.class_name, 'Unassigned') AS class_name,
              r.subject, r.score, r.created_at
       FROM results r
       WHERE r.student_id = $1
       ORDER BY COALESCE(r.term, 'Unassigned'), r.created_at ASC`,
      [req.params.id]
    );
    const rankings = await query<{
      term: string; student_id: string; admission_number: string; name: string;
      average: number; rank: number; total_students: number;
    }>(rankingQuery);
    const summaries = rankings.rows
      .filter((ranking) => ranking.student_id === req.params.id)
      .map(({ term, average, rank, total_students }) => ({ term, average, rank, totalStudents: total_students }));
    res.json({ student: student.rows[0], results: results.rows, summaries, rankings: rankings.rows });
  } catch (error) { next(error); }
});

app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => console.log(`API listening on port ${config.port}`));
}

export default app;

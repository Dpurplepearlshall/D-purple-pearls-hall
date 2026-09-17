import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool, query } from './db.js';
import { authenticate, comparePassword, hashPassword, issueToken, requireRole } from './auth.js';
import { errorHandler, notFound } from './middleware.js';
import { changePasswordSchema, loginSchema, registrationSchema, resultSchema, studentSchema, teacherRegistrationSchema, teacherSchema } from './validation.js';

const app = express();
app.use(cors({ origin: config.frontendUrl, credentials: false }));
app.use(express.json({ limit: '1mb' }));

async function logActivity(userId: string | null, event: string, metadata: Record<string, unknown> = {}) {
  await query('INSERT INTO activity_logs (user_id, event, metadata) VALUES ($1, $2, $3)', [
    userId,
    event,
    JSON.stringify(metadata)
  ]);
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
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

app.get('/api/owner/students', authenticate, requireRole('owner'), async (_req, res, next) => {
  try {
    const result = await query('SELECT id, admission_number, name, active, created_at FROM allowed_students ORDER BY created_at DESC');
    res.json({ students: result.rows });
  } catch (error) { next(error); }
});

app.post('/api/owner/students', authenticate, requireRole('owner'), async (req, res, next) => {
  try {
    const input = studentSchema.parse(req.body);
    const result = await query(
      `INSERT INTO allowed_students (admission_number, name) VALUES ($1, $2)
       ON CONFLICT (admission_number) DO UPDATE SET name = EXCLUDED.name, active = true
       RETURNING id, admission_number, name, active, created_at`,
      [input.admissionNumber, input.name]
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
      `INSERT INTO results (student_id, term, subject, score, uploaded_by) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [student.rows[0].id, input.term, input.subject, input.score, req.user!.id]
    );
    await logActivity(req.user!.id, 'result_uploaded', {
      studentAdmissionNumber: input.studentAdmissionNumber, term: input.term, subject: input.subject, score: input.score
    });
    res.status(201).json({ result: result.rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/results/me', authenticate, requireRole('student'), async (req, res, next) => {
  try {
    const result = await query<{ id: string; term: string | null; subject: string; score: number; created_at: string }>(
      `SELECT r.id, COALESCE(r.term, 'Unassigned') AS term, r.subject, r.score, r.created_at
       FROM results r
       JOIN users u ON u.student_id = r.student_id
       WHERE u.id = $1
       ORDER BY COALESCE(r.term, 'Unassigned'), r.created_at ASC
       LIMIT 200`,
      [req.user!.id]
    );
    res.json({ results: result.rows });
  } catch (error) { next(error); }
});

app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => console.log(`API listening on port ${config.port}`));
}

export default app;

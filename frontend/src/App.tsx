import { useEffect, useState } from 'react';
import { api, type Activity, type NewsPost, type PublicHome, type Result, type SchoolCalendar, type Student, type StudentResultDetails, type Teacher, type TermSummary, type User } from './api';

type Notice = { type: 'error' | 'success'; text: string } | null;
const date = (value: string) => new Date(value).toLocaleString();
const schoolClasses = ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3', 'Graduated'];

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label><span>{label}</span><input required type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><input type="date" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Login({ onLogin, onBack, initialOwnerMode }: { onLogin: (user: User, token: string) => void; onBack: () => void; initialOwnerMode: boolean }) {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [ownerMode, setOwnerMode] = useState(initialOwnerMode);
  const [registerRole, setRegisterRole] = useState<'student' | 'teacher'>('student');
  const [notice, setNotice] = useState<Notice>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setNotice(null);
    try {
      if (register) {
        const result = registerRole === 'student'
          ? await api.registerStudent(identifier, email, password)
          : await api.registerTeacher(identifier, email, password);
        setNotice({ type: 'success', text: result.message }); setRegister(false);
      } else {
        const result = await api.login(identifier, password);
        localStorage.setItem('token', result.token); onLogin(result.user, result.token);
      }
    } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' }); }
  };
  return <main className="auth-shell">
    <section className="auth-card">
      <img className="brand-mark" src="/school-logo.jpg" alt="D Purple Pearls Hall logo" />
      <p className="eyebrow">D-PURPLE PEARLS HALL</p>
      <h1>{register ? `${registerRole === 'student' ? 'Student' : 'Teacher'} registration` : ownerMode ? 'Owner login' : 'Welcome back'}</h1>
      <p className="muted">{register ? `Your ${registerRole === 'student' ? 'admission number' : 'teacher ID'} must be on the owner's active whitelist. Your registered name comes from the school record.` : ownerMode ? 'Sign in to manage whitelists, accounts, and activity.' : 'Students use their admission number and teachers use their teacher ID to sign in.'}</p>
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      <form onSubmit={submit}>
        {register && <><div className="role-toggle"><button type="button" className={registerRole === 'student' ? 'selected' : ''} onClick={() => setRegisterRole('student')}>Student</button><button type="button" className={registerRole === 'teacher' ? 'selected' : ''} onClick={() => setRegisterRole('teacher')}>Teacher</button></div><Field label={registerRole === 'student' ? 'Admission number' : 'Teacher ID'} value={identifier} onChange={setIdentifier} /><Field label="Gmail address" type="email" value={email} onChange={setEmail} placeholder="you@gmail.com" /></>}
        {!register && <Field label={ownerMode ? 'Owner name' : 'Admission number or Teacher ID'} type="text" value={identifier} onChange={setIdentifier} placeholder={ownerMode ? 'Umm Raaidah' : 'Enter your school ID'} />}
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
        <button className="primary" type="submit">{register ? `Create ${registerRole} account` : 'Sign in'}</button>
      </form>
      <button className="link-button" onClick={() => { setRegister(!register); setOwnerMode(false); setNotice(null); }}>{register ? 'Already registered? Sign in' : 'Student or teacher: create account'}</button>
      {!register && <button className="link-button secondary-link" onClick={() => { setOwnerMode(!ownerMode); setNotice(null); }}>{ownerMode ? 'Back to student/teacher login' : 'Owner login'}</button>}
      {!register && <button className="link-button secondary-link" onClick={onBack}>Back to school news</button>}
    </section>
  </main>;
}

function NewsHome({ onLogin }: { onLogin: (ownerMode: boolean) => void }) {
  const [home, setHome] = useState<PublicHome | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.publicHome().then(setHome).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load school news.')); }, []);
  const dateValue = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : 'Not announced';
  return <main className="news-page">
    <header className="news-header"><div className="news-brand"><img className="small-brand" src="/school-logo.jpg" alt="D Purple Pearls Hall logo" /><strong>D-PURPLE PEARLS HALL</strong></div><nav><button className="secondary" onClick={() => onLogin(false)}>Student / Teacher Login</button><button className="primary" onClick={() => onLogin(true)}>Owner Login</button></nav></header>
    <section className="news-hero"><p className="eyebrow">SCHOOL ANNOUNCEMENTS</p><h1>News & Updates</h1><p>Important notices and dates from D Purple Pearls Hall.</p></section>
    {home && <section className="calendar-strip">
      <div><span>Vacation begins</span><strong>{dateValue(home.calendar?.vacation_date)}</strong></div>
      <div><span>Results released</span><strong>{dateValue(home.calendar?.results_release_date)}</strong></div>
      <div><span>School resumes</span><strong>{dateValue(home.calendar?.resumption_date)}</strong></div>
    </section>}
    {error && <p className="notice error">{error}</p>}
    <section className="news-grid">{home?.news.length ? home.news.map((item) => <article className="news-card" key={item.id}><time>{date(item.created_at)}</time><h2>{item.heading}</h2><p>{item.body}</p></article>) : <article className="news-card"><h2>Welcome</h2><p>School announcements will appear here when they are posted.</p></article>}</section>
    <p className="promotion-note">Student classes are advanced annually after August according to the Nigerian school progression sequence.</p>
  </main>;
}

function OwnerPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'students' | 'teachers' | 'activity' | 'news' | 'calendar'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [studentForm, setStudentForm] = useState({ id: '', name: '', currentClass: 'JSS 1' });
  const [teacherForm, setTeacherForm] = useState({ id: '', name: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [selectedStudent, setSelectedStudent] = useState<StudentResultDetails | null>(null);
  const [news, setNews] = useState<NewsPost[]>([]);
  const [newsForm, setNewsForm] = useState({ heading: '', body: '' });
  const [calendar, setCalendar] = useState<SchoolCalendar>({ vacation_date: '', results_release_date: '', resumption_date: '' });
  const load = async () => {
    try {
      if (tab === 'students') setStudents((await api.students()).students);
      if (tab === 'teachers') setTeachers((await api.teachers()).teachers);
      if (tab === 'activity') setActivity((await api.activity()).activity);
      if (tab === 'news') setNews((await api.news()).news);
      if (tab === 'calendar') {
        const savedCalendar = (await api.calendar()).calendar;
        setCalendar({
          vacation_date: savedCalendar.vacation_date?.slice(0, 10) ?? '',
          results_release_date: savedCalendar.results_release_date?.slice(0, 10) ?? '',
          resumption_date: savedCalendar.resumption_date?.slice(0, 10) ?? ''
        });
      }
    } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load data.' }); }
  };
  useEffect(() => { void load(); }, [tab]);
  const saveStudent = async (e: React.FormEvent) => { e.preventDefault(); try { await api.addStudent(studentForm.id, studentForm.name, studentForm.currentClass); setStudentForm({ id: '', name: '', currentClass: 'JSS 1' }); setNotice({ type: 'success', text: 'Student added to the whitelist.' }); load(); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to save.' }); } };
  const saveTeacher = async (e: React.FormEvent) => { e.preventDefault(); try { await api.addTeacher(teacherForm.id, teacherForm.name); setTeacherForm({ id: '', name: '' }); setNotice({ type: 'success', text: 'Teacher added to the whitelist.' }); load(); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to save.' }); } };
  const remove = async (kind: 'student' | 'teacher', id: string) => { if (!confirm('Mark this account inactive and remove its login?')) return; try { kind === 'student' ? await api.deleteStudent(id) : await api.deleteTeacher(id); load(); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to delete.' }); } };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) { setNotice({ type: 'error', text: 'The new passwords do not match.' }); return; }
    try {
      const result = await api.changeOwnerPassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setNotice({ type: 'success', text: result.message });
    } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to change password.' }); }
  };
  const postNews = async (e: React.FormEvent) => { e.preventDefault(); try { const result = await api.addNews(newsForm.heading, newsForm.body); setNews([result.news, ...news]); setNewsForm({ heading: '', body: '' }); setNotice({ type: 'success', text: 'News posted and visible on the school home page.' }); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to post news.' }); } };
  const removeNews = async (id: string) => { try { await api.deleteNews(id); setNews(news.filter((item) => item.id !== id)); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to remove news.' }); } };
  const saveCalendar = async (e: React.FormEvent) => { e.preventDefault(); try { const result = await api.saveCalendar(calendar); setCalendar(result.calendar); setNotice({ type: 'success', text: 'School dates saved and published on the home page.' }); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to save school dates.' }); } };
  return <PortalLayout title="Owner console" onLogout={onLogout}>
    <nav className="tabs">{(['students', 'teachers', 'activity', 'news', 'calendar'] as const).map((item) => <button className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setTimeout(load, 0); }} key={item}>{item === 'students' ? 'Students' : item === 'teachers' ? 'Teachers' : item === 'activity' ? 'Activity log' : item === 'news' ? 'School news' : 'School calendar'}</button>)}</nav>
    {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
    {tab === 'students' && <><section className="panel"><h2>Add student to whitelist</h2><form className="student-add-form" onSubmit={saveStudent}><Field label="Admission number" value={studentForm.id} onChange={(v) => setStudentForm({ ...studentForm, id: v })} /><Field label="Full name" value={studentForm.name} onChange={(v) => setStudentForm({ ...studentForm, name: v })} /><label><span>Class</span><select value={studentForm.currentClass} onChange={(e) => setStudentForm({ ...studentForm, currentClass: e.target.value })}>{schoolClasses.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary">Add to whitelist</button></form></section><section className="panel class-register"><h2>Student whitelist and class register</h2><p className="muted">Select an admission number to open its score history, including inactive students.</p>{schoolClasses.map((className) => { const group = students.filter((student) => student.current_class === className); return group.length ? <div key={className}><h3>{className}</h3><table className="result-table"><thead><tr><th>Admission number</th><th>Student name</th><th>Login status</th><th>Action</th></tr></thead><tbody>{group.map((student) => <tr key={student.id}><td><button className="text-link" onClick={async () => { try { setSelectedStudent(await api.studentResults(student.id)); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to load student results.' }); } }}>{student.admission_number}</button></td><td>{student.name}</td><td><span className={student.active ? 'status active-status' : 'status'}>{student.active ? 'Active' : 'Inactive'}</span></td><td>{student.active && <button className="danger" onClick={() => remove('student', student.id)}>Deactivate</button>}</td></tr>)}</tbody></table></div> : null; })}{students.length === 0 && <p className="muted">No students have been added yet.</p>}</section>{selectedStudent && <OwnerStudentResults key={selectedStudent.student.id} details={selectedStudent} />}</>}
    {tab === 'teachers' && <section className="panel-grid"><div className="panel"><h2>Add teacher</h2><form onSubmit={saveTeacher}><Field label="Teacher ID" value={teacherForm.id} onChange={(v) => setTeacherForm({ ...teacherForm, id: v })} /><Field label="Full name" value={teacherForm.name} onChange={(v) => setTeacherForm({ ...teacherForm, name: v })} /><button className="primary">Add to whitelist</button></form></div><List title="Allowed teachers" empty="No teachers yet." rows={teachers.map((t) => ({ id: t.id, primary: t.teacher_id, secondary: t.name, active: t.active }))} onDelete={(id) => remove('teacher', id)} /></section>}
    {tab === 'activity' && <section className="panel"><h2>Recent sign-ins & result uploads</h2><button className="secondary refresh" onClick={load}>Refresh</button>{activity.length === 0 ? <p className="muted">No activity recorded yet.</p> : <div className="activity-list">{activity.map((item) => <div className="activity" key={item.id}><span className={`event-dot ${item.event === 'login' ? 'login' : 'upload'}`} /><div><strong>{item.event === 'login' ? 'Signed in' : 'Result uploaded'}</strong><p>{item.display_name ?? item.username ?? 'Deleted account'} · {item.role ?? 'unknown'}{item.event === 'result_uploaded' && ` · ${String(item.metadata.studentAdmissionNumber ?? '')} · ${String(item.metadata.className ?? '')} · ${String(item.metadata.term ?? '')}`}</p></div><time>{date(item.created_at)}</time></div>)}</div>}</section>}
    {tab === 'news' && <section className="panel-grid"><div className="panel"><h2>Post a school announcement</h2><p className="muted">New posts become visible on the public school home page immediately.</p><form onSubmit={postNews}><Field label="Heading" value={newsForm.heading} onChange={(v) => setNewsForm({ ...newsForm, heading: v })} /><label><span>Announcement</span><textarea required rows={8} maxLength={10000} value={newsForm.body} onChange={(e) => setNewsForm({ ...newsForm, body: e.target.value })} /></label><button className="primary">Post news</button></form></div><section className="panel"><h2>Published news</h2>{news.length ? news.map((item) => <article className="owner-news-item" key={item.id}><time>{date(item.created_at)}</time><h3>{item.heading}</h3><p>{item.body}</p><button className="danger" onClick={() => removeNews(item.id)}>Remove</button></article>) : <p className="muted">No news has been posted.</p>}</section></section>}
    {tab === 'calendar' && <section className="panel narrow"><h2>School calendar dates</h2><p className="muted">Set or update dates shown on the school home page. Dates are optional until confirmed.</p><form onSubmit={saveCalendar}><DateField label="Vacation begins" value={calendar.vacation_date ?? ''} onChange={(value) => setCalendar({ ...calendar, vacation_date: value || null })} /><DateField label="Results released" value={calendar.results_release_date ?? ''} onChange={(value) => setCalendar({ ...calendar, results_release_date: value || null })} /><DateField label="School resumes" value={calendar.resumption_date ?? ''} onChange={(value) => setCalendar({ ...calendar, resumption_date: value || null })} /><button className="primary">Save calendar</button></form><p className="muted">Class advancement runs automatically on the first portal request from September onward, once per year: Primary 1–6, JSS 1–3, then SS 1–3. Graduated students keep their records.</p></section>}
    <section className="panel narrow"><h2>Change owner password</h2><p className="muted">You will need your current password. Use at least 8 characters.</p><form onSubmit={changePassword}><Field label="Current password" type="password" value={passwordForm.current} onChange={(v) => setPasswordForm({ ...passwordForm, current: v })} /><Field label="New password" type="password" value={passwordForm.next} onChange={(v) => setPasswordForm({ ...passwordForm, next: v })} /><Field label="Confirm new password" type="password" value={passwordForm.confirm} onChange={(v) => setPasswordForm({ ...passwordForm, confirm: v })} /><button className="primary">Change password</button></form></section>
  </PortalLayout>;
}

function List({ title, empty, rows, onDelete, onPrimaryClick }: { title: string; empty: string; rows: { id: string; primary: string; secondary: string; active: boolean }[]; onDelete: (id: string) => void; onPrimaryClick?: (id: string) => void }) {
  return <div className="panel"><h2>{title}</h2>{rows.length === 0 ? <p className="muted">{empty}</p> : <div className="record-list">{rows.map((row) => <div className="record" key={row.id}><div>{onPrimaryClick ? <button className="text-link" onClick={() => onPrimaryClick(row.id)}>{row.primary}</button> : <strong>{row.primary}</strong>}<span>{row.secondary}</span></div><span className={row.active ? 'status active-status' : 'status'}>{row.active ? 'Active' : 'Inactive'}</span>{row.active && <button className="danger" onClick={() => onDelete(row.id)}>Delete</button>}</div>)}</div>}</div>;
}

function OwnerStudentResults({ details }: { details: StudentResultDetails }) {
  const [term, setTerm] = useState(details.summaries[0]?.term ?? 'Term 1');
  const summary = details.summaries.find((item) => item.term === term);
  const rankings = details.rankings.filter((item) => item.term === term);
  const results = details.results.filter((item) => item.term === term);
  return <section className="panel owner-results"><h2>{details.student.admission_number} · {details.student.name}</h2><p className="muted">Scores and class ranking for every student with results in the selected term.</p><label><span>View term</span><select value={term} onChange={(e) => setTerm(e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></label>{summary && <div className="summary-grid"><div className="summary-card"><span>{summary.term} average</span><strong>{Number(summary.average).toFixed(2)}<small>/100</small></strong><p>Ranked <b>#{summary.rank}</b> of {summary.totalStudents} students</p></div></div>}<h3>Student scores</h3>{results.length === 0 ? <p className="muted">No scores for this term.</p> : <div className="result-table-wrap"><table className="result-table"><thead><tr><th>Class</th><th>Subject</th><th>Score</th><th>Letter grade</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}><td>{result.class_name}</td><td>{result.subject}</td><td>{Number(result.score)}</td><td>{letterGrade(Number(result.score))}</td></tr>)}</tbody></table></div>}<h3>All student rankings</h3>{rankings.length === 0 ? <p className="muted">No rankings are available for this term.</p> : <div className="result-table-wrap"><table className="result-table"><thead><tr><th>Rank</th><th>Admission number</th><th>Student</th><th>Average / 100</th></tr></thead><tbody>{rankings.map((ranking) => <tr className={ranking.student_id === details.student.id ? 'highlight-row' : ''} key={`${ranking.term}-${ranking.student_id}`}><td>#{ranking.rank}</td><td>{ranking.admission_number}</td><td>{ranking.name}</td><td>{Number(ranking.average).toFixed(2)}</td></tr>)}</tbody></table></div>}</section>;
}

function TeacherPanel({ onLogout }: { onLogout: () => void }) {
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [className, setClassName] = useState('');
  const [term, setTerm] = useState('Term 1');
  const [rows, setRows] = useState(() => Array.from({ length: 20 }, () => ({ subject: '', score: '' })));
  const [notice, setNotice] = useState<Notice>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((row) => row.subject.trim() || row.score !== '');
    if (!filled.length) { setNotice({ type: 'error', text: 'Enter at least one subject and score.' }); return; }
    if (filled.some((row) => !row.subject.trim() || row.score === '' || Number(row.score) < 0 || Number(row.score) > 100)) {
      setNotice({ type: 'error', text: 'Each used row needs a subject and a score from 0 to 100.' }); return;
    }
    try {
      for (const row of filled) await api.uploadResult({ studentAdmissionNumber: admissionNumber, className, term, subject: row.subject, score: Number(row.score) });
      setNotice({ type: 'success', text: `${filled.length} result${filled.length === 1 ? '' : 's'} uploaded successfully.` });
      setRows(Array.from({ length: 20 }, () => ({ subject: '', score: '' })));
    } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to upload results.' }); }
  };
  return <PortalLayout title="Teacher workspace" onLogout={onLogout}><section className="panel"><h2>Upload student results</h2><p className="muted">Only active whitelisted students can receive results.</p>{notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}<form onSubmit={submit}><Field label="Student admission number" value={admissionNumber} onChange={setAdmissionNumber} /><Field label="Current class" value={className} onChange={setClassName} placeholder="For example, JSS 2A" /><label><span>School term</span><select value={term} onChange={(e) => setTerm(e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></label><div className="result-table-wrap"><table className="result-table"><thead><tr><th>Subject</th><th>Grade in number</th><th>Letter grade</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><input aria-label={`Subject ${index + 1}`} value={row.subject} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, subject: e.target.value } : item))} /></td><td><input aria-label={`Score ${index + 1}`} type="number" min="0" max="100" value={row.score} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, score: e.target.value } : item))} /></td><td>{row.score === '' ? '-' : letterGrade(Number(row.score))}</td></tr>)}</tbody></table></div><button className="primary">Upload results</button></form></section></PortalLayout>;
}

function StudentPanel({ onLogout }: { onLogout: () => void }) {
  const [results, setResults] = useState<Result[]>([]);
  const [summaries, setSummaries] = useState<TermSummary[]>([]);
  const [term, setTerm] = useState('all');
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => { api.myResults().then((response) => { setResults(response.results); setSummaries(response.summaries); }).catch((error) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load results.' })); }, []);
  const visibleResults = term === 'all' ? results : results.filter((result) => result.term === term);
  const visibleSummary = summaries.find((summary) => summary.term === term);
  return <PortalLayout title="Student workspace" onLogout={onLogout}><section className="panel"><h2>Your term performance</h2>{notice && <div className="notice error">{notice.text}</div>}<div className="summary-grid">{(term === 'all' ? summaries : visibleSummary ? [visibleSummary] : []).map((summary) => <div className="summary-card" key={summary.term}><span>{summary.term}</span><strong>{Number(summary.average).toFixed(2)}<small>/100</small></strong><p>Ranked <b>#{summary.rank}</b> of {summary.totalStudents} students</p></div>)}</div><label><span>View term</span><select value={term} onChange={(e) => setTerm(e.target.value)}><option value="all">All terms</option><option>Term 1</option><option>Term 2</option><option>Term 3</option><option>Unassigned</option></select></label>{visibleResults.length === 0 ? <p className="muted">No results have been uploaded for this term.</p> : <div className="result-table-wrap"><table className="result-table"><thead><tr><th>Term</th><th>Class</th><th>Subject</th><th>Grade in number</th><th>Letter grade</th></tr></thead><tbody>{visibleResults.map((result) => <tr key={result.id}><td>{result.term}</td><td>{result.class_name}</td><td>{result.subject}</td><td>{Number(result.score)}</td><td>{letterGrade(Number(result.score))}</td></tr>)}</tbody></table></div>}</section></PortalLayout>;
}

function letterGrade(score: number) {
  if (score >= 75) return 'A1';
  if (score >= 70) return 'B2';
  if (score >= 65) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'E8';
  return 'F9';
}

function PortalLayout({ title, onLogout, children }: { title: string; onLogout: () => void; children: React.ReactNode }) {
  return <div className="portal"><header><div><img className="small-brand" src="/school-logo.jpg" alt="D Purple Pearls Hall logo" /><strong>{title}</strong></div><button className="secondary" onClick={onLogout}>Sign out</button></header><main className="content">{children}</main></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [ownerMode, setOwnerMode] = useState(false);
  if (!user && !showLogin) return <NewsHome onLogin={(isOwner) => { setOwnerMode(isOwner); setShowLogin(true); }} />;
  if (!user) return <Login key={String(ownerMode)} initialOwnerMode={ownerMode} onBack={() => setShowLogin(false)} onLogin={(nextUser, token) => { localStorage.setItem('token', token); setUser(nextUser); }} />;
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  if (user.role === 'owner') return <OwnerPanel onLogout={logout} />;
  if (user.role === 'teacher') return <TeacherPanel onLogout={logout} />;
  return <StudentPanel onLogout={logout} />;
}

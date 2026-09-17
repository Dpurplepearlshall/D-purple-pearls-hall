import { useEffect, useState } from 'react';
import { api, type Activity, type Result, type Student, type Teacher, type User } from './api';

type Notice = { type: 'error' | 'success'; text: string } | null;
const date = (value: string) => new Date(value).toLocaleString();

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label><span>{label}</span><input required type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Login({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [ownerMode, setOwnerMode] = useState(false);
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
    </section>
  </main>;
}

function OwnerPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'students' | 'teachers' | 'activity'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [studentForm, setStudentForm] = useState({ id: '', name: '' });
  const [teacherForm, setTeacherForm] = useState({ id: '', name: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const load = async () => {
    try {
      if (tab === 'students') setStudents((await api.students()).students);
      if (tab === 'teachers') setTeachers((await api.teachers()).teachers);
      if (tab === 'activity') setActivity((await api.activity()).activity);
    } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load data.' }); }
  };
  useEffect(() => { void load(); }, [tab]);
  const saveStudent = async (e: React.FormEvent) => { e.preventDefault(); try { await api.addStudent(studentForm.id, studentForm.name); setStudentForm({ id: '', name: '' }); setNotice({ type: 'success', text: 'Student added to the whitelist.' }); load(); } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to save.' }); } };
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
  return <PortalLayout title="Owner console" onLogout={onLogout}>
    <nav className="tabs">{(['students', 'teachers', 'activity'] as const).map((item) => <button className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setTimeout(load, 0); }} key={item}>{item === 'students' ? 'Students' : item === 'teachers' ? 'Teachers' : 'Activity log'}</button>)}</nav>
    {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
    {tab === 'students' && <section className="panel-grid"><div className="panel"><h2>Add student</h2><form onSubmit={saveStudent}><Field label="Admission number" value={studentForm.id} onChange={(v) => setStudentForm({ ...studentForm, id: v })} /><Field label="Full name" value={studentForm.name} onChange={(v) => setStudentForm({ ...studentForm, name: v })} /><button className="primary">Add to whitelist</button></form></div><List title="Allowed students" empty="No students yet." rows={students.map((s) => ({ id: s.id, primary: s.admission_number, secondary: s.name, active: s.active }))} onDelete={(id) => remove('student', id)} /></section>}
    {tab === 'teachers' && <section className="panel-grid"><div className="panel"><h2>Add teacher</h2><form onSubmit={saveTeacher}><Field label="Teacher ID" value={teacherForm.id} onChange={(v) => setTeacherForm({ ...teacherForm, id: v })} /><Field label="Full name" value={teacherForm.name} onChange={(v) => setTeacherForm({ ...teacherForm, name: v })} /><button className="primary">Add to whitelist</button></form></div><List title="Allowed teachers" empty="No teachers yet." rows={teachers.map((t) => ({ id: t.id, primary: t.teacher_id, secondary: t.name, active: t.active }))} onDelete={(id) => remove('teacher', id)} /></section>}
    {tab === 'activity' && <section className="panel"><h2>Recent sign-ins & result uploads</h2><button className="secondary refresh" onClick={load}>Refresh</button>{activity.length === 0 ? <p className="muted">No activity recorded yet.</p> : <div className="activity-list">{activity.map((item) => <div className="activity" key={item.id}><span className={`event-dot ${item.event === 'login' ? 'login' : 'upload'}`} /><div><strong>{item.event === 'login' ? 'Signed in' : 'Result uploaded'}</strong><p>{item.display_name ?? item.username ?? 'Deleted account'} · {item.role ?? 'unknown'}</p></div><time>{date(item.created_at)}</time></div>)}</div>}</section>}
    <section className="panel narrow"><h2>Change owner password</h2><p className="muted">You will need your current password. Use at least 8 characters.</p><form onSubmit={changePassword}><Field label="Current password" type="password" value={passwordForm.current} onChange={(v) => setPasswordForm({ ...passwordForm, current: v })} /><Field label="New password" type="password" value={passwordForm.next} onChange={(v) => setPasswordForm({ ...passwordForm, next: v })} /><Field label="Confirm new password" type="password" value={passwordForm.confirm} onChange={(v) => setPasswordForm({ ...passwordForm, confirm: v })} /><button className="primary">Change password</button></form></section>
  </PortalLayout>;
}

function List({ title, empty, rows, onDelete }: { title: string; empty: string; rows: { id: string; primary: string; secondary: string; active: boolean }[]; onDelete: (id: string) => void }) {
  return <div className="panel"><h2>{title}</h2>{rows.length === 0 ? <p className="muted">{empty}</p> : <div className="record-list">{rows.map((row) => <div className="record" key={row.id}><div><strong>{row.primary}</strong><span>{row.secondary}</span></div><span className={row.active ? 'status active-status' : 'status'}>{row.active ? 'Active' : 'Inactive'}</span>{row.active && <button className="danger" onClick={() => onDelete(row.id)}>Delete</button>}</div>)}</div>}</div>;
}

function TeacherPanel({ onLogout }: { onLogout: () => void }) {
  const [admissionNumber, setAdmissionNumber] = useState('');
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
      for (const row of filled) await api.uploadResult({ studentAdmissionNumber: admissionNumber, term, subject: row.subject, score: Number(row.score) });
      setNotice({ type: 'success', text: `${filled.length} result${filled.length === 1 ? '' : 's'} uploaded successfully.` });
      setRows(Array.from({ length: 20 }, () => ({ subject: '', score: '' })));
    } catch (e) { setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Unable to upload results.' }); }
  };
  return <PortalLayout title="Teacher workspace" onLogout={onLogout}><section className="panel"><h2>Upload student results</h2><p className="muted">Only active whitelisted students can receive results.</p>{notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}<form onSubmit={submit}><Field label="Student admission number" value={admissionNumber} onChange={setAdmissionNumber} /><label><span>School term</span><select value={term} onChange={(e) => setTerm(e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></label><div className="result-table-wrap"><table className="result-table"><thead><tr><th>Subject</th><th>Grade in number</th><th>Letter grade</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><input aria-label={`Subject ${index + 1}`} value={row.subject} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, subject: e.target.value } : item))} /></td><td><input aria-label={`Score ${index + 1}`} type="number" min="0" max="100" value={row.score} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, score: e.target.value } : item))} /></td><td>{row.score === '' ? '-' : letterGrade(Number(row.score))}</td></tr>)}</tbody></table></div><button className="primary">Upload results</button></form></section></PortalLayout>;
}

function StudentPanel({ onLogout }: { onLogout: () => void }) {
  const [results, setResults] = useState<Result[]>([]);
  const [term, setTerm] = useState('all');
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => { api.myResults().then((response) => setResults(response.results)).catch((error) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load results.' })); }, []);
  const visibleResults = term === 'all' ? results : results.filter((result) => result.term === term);
  return <PortalLayout title="Student workspace" onLogout={onLogout}><section className="panel"><h2>Your results</h2>{notice && <div className="notice error">{notice.text}</div>}<label><span>View term</span><select value={term} onChange={(e) => setTerm(e.target.value)}><option value="all">All terms</option><option>Term 1</option><option>Term 2</option><option>Term 3</option><option>Unassigned</option></select></label>{visibleResults.length === 0 ? <p className="muted">No results have been uploaded for this term.</p> : <div className="result-table-wrap"><table className="result-table"><thead><tr><th>Term</th><th>Subject</th><th>Grade in number</th><th>Letter grade</th></tr></thead><tbody>{visibleResults.map((result) => <tr key={result.id}><td>{result.term}</td><td>{result.subject}</td><td>{Number(result.score)}</td><td>{letterGrade(Number(result.score))}</td></tr>)}</tbody></table></div>}</section></PortalLayout>;
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
  if (!user) return <Login onLogin={(nextUser, token) => { localStorage.setItem('token', token); setUser(nextUser); }} />;
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  if (user.role === 'owner') return <OwnerPanel onLogout={logout} />;
  if (user.role === 'teacher') return <TeacherPanel onLogout={logout} />;
  return <StudentPanel onLogout={logout} />;
}

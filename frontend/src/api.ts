const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export type User = { id: string; email: string; role: 'owner' | 'student' | 'teacher'; displayName: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Request failed.');
  return body as T;
}

export const api = {
  login: (identifier: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  changeOwnerPassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/owner/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  resetAccountPassword: (role: 'student' | 'teacher', schoolId: string, temporaryPassword: string) =>
    request<{ message: string }>('/owner/accounts/reset-password', { method: 'POST', body: JSON.stringify({ role, schoolId, temporaryPassword }) }),
  downloadOwnerExport: async (dataset: 'students' | 'teachers' | 'results' | 'activity' | 'backup') => {
    const token = localStorage.getItem('token');
    const endpoint = dataset === 'backup' ? '/owner/backup' : `/owner/exports/${dataset}`;
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? 'Unable to download the export.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dataset === 'backup' ? 'school-portal-backup.pdf' : `${dataset}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  registerStudent: (admissionNumber: string, email: string, password: string) =>
    request<{ message: string }>('/auth/register/student', { method: 'POST', body: JSON.stringify({ admissionNumber, email, password }) }),
  registerTeacher: (teacherId: string, email: string, password: string) =>
    request<{ message: string }>('/auth/register/teacher', { method: 'POST', body: JSON.stringify({ teacherId, email, password }) }),
  students: () => request<{ students: Student[] }>('/owner/students'),
  addStudent: (admissionNumber: string, name: string, currentClass: string) =>
    request<{ student: Student }>('/owner/students', { method: 'POST', body: JSON.stringify({ admissionNumber, name, currentClass }) }),
  deleteStudent: (id: string) => request<{ message: string }>(`/owner/students/${id}`, { method: 'DELETE' }),
  teachers: () => request<{ teachers: Teacher[] }>('/owner/teachers'),
  addTeacher: (teacherId: string, name: string) =>
    request<{ teacher: Teacher }>('/owner/teachers', { method: 'POST', body: JSON.stringify({ teacherId, name }) }),
  deleteTeacher: (id: string) => request<{ message: string }>(`/owner/teachers/${id}`, { method: 'DELETE' }),
  activity: () => request<{ activity: Activity[] }>('/owner/activity'),
  publicHome: () => request<PublicHome>('/public/home'),
  news: () => request<{ news: NewsPost[] }>('/owner/news'),
  addNews: (heading: string, body: string) =>
    request<{ news: NewsPost }>('/owner/news', { method: 'POST', body: JSON.stringify({ heading, body }) }),
  deleteNews: (id: string) => request<{ message: string }>(`/owner/news/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  calendar: () => request<{ calendar: SchoolCalendar }>('/owner/calendar'),
  saveCalendar: (calendar: SchoolCalendar) =>
    request<{ calendar: SchoolCalendar }>('/owner/calendar', { method: 'PUT', body: JSON.stringify(calendar) }),
  uploadResult: (data: { studentAdmissionNumber: string; className: string; term: string; subject: string; score: number }) =>
    request<{ result: { id: string; created_at: string } }>('/results', { method: 'POST', body: JSON.stringify(data) }),
  myResults: () => request<{ results: Result[]; summaries: TermSummary[] }>('/results/me'),
  studentResults: (id: string) => request<StudentResultDetails>(`/owner/students/${encodeURIComponent(id)}/results`)
};

export type Student = { id: string; admission_number: string; name: string; active: boolean; current_class: string; created_at: string };
export type Teacher = { id: string; teacher_id: string; name: string; active: boolean; created_at: string };
export type Activity = { id: number; event: string; metadata: Record<string, unknown>; created_at: string; username?: string; display_name?: string; role?: string };
export type Result = { id: string; term: string; class_name: string; subject: string; score: number; created_at: string };
export type TermSummary = { term: string; average: number; rank: number; totalStudents: number };
export type Ranking = { term: string; student_id: string; admission_number: string; name: string; average: number; rank: number };
export type StudentResultDetails = {
  student: Student;
  results: Result[];
  summaries: TermSummary[];
  rankings: Ranking[];
};
export type NewsPost = { id: string; heading: string; body: string; created_at: string };
export type SchoolCalendar = { vacation_date: string | null; results_release_date: string | null; resumption_date: string | null };
export type PublicHome = { news: NewsPost[]; calendar: SchoolCalendar };

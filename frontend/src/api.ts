const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export type User = { id: string; email: string; role: 'owner' | 'student' | 'teacher'; displayName: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
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
  registerStudent: (admissionNumber: string, email: string, password: string) =>
    request<{ message: string }>('/auth/register/student', { method: 'POST', body: JSON.stringify({ admissionNumber, email, password }) }),
  registerTeacher: (teacherId: string, email: string, password: string) =>
    request<{ message: string }>('/auth/register/teacher', { method: 'POST', body: JSON.stringify({ teacherId, email, password }) }),
  students: () => request<{ students: Student[] }>('/owner/students'),
  addStudent: (admissionNumber: string, name: string) =>
    request<{ student: Student }>('/owner/students', { method: 'POST', body: JSON.stringify({ admissionNumber, name }) }),
  deleteStudent: (id: string) => request<{ message: string }>(`/owner/students/${id}`, { method: 'DELETE' }),
  teachers: () => request<{ teachers: Teacher[] }>('/owner/teachers'),
  addTeacher: (teacherId: string, name: string) =>
    request<{ teacher: Teacher }>('/owner/teachers', { method: 'POST', body: JSON.stringify({ teacherId, name }) }),
  deleteTeacher: (id: string) => request<{ message: string }>(`/owner/teachers/${id}`, { method: 'DELETE' }),
  activity: () => request<{ activity: Activity[] }>('/owner/activity'),
  uploadResult: (data: { studentAdmissionNumber: string; subject: string; score: number }) =>
    request<{ result: { id: string; created_at: string } }>('/results', { method: 'POST', body: JSON.stringify(data) })
};

export type Student = { id: string; admission_number: string; name: string; active: boolean; created_at: string };
export type Teacher = { id: string; teacher_id: string; name: string; active: boolean; created_at: string };
export type Activity = { id: number; event: string; metadata: Record<string, unknown>; created_at: string; username?: string; display_name?: string; role?: string };

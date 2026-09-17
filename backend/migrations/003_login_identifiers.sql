UPDATE users
SET username = allowed_students.admission_number
FROM allowed_students
WHERE users.student_id = allowed_students.id
  AND users.role = 'student';

UPDATE users
SET username = allowed_teachers.teacher_id
FROM allowed_teachers
WHERE users.teacher_id = allowed_teachers.id
  AND users.role = 'teacher';

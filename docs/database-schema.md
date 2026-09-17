# Esquema Físico de Base de Datos (Prisma / PostgreSQL V1 + Auth Schema V1 Definitivo) - PotroLearn

Este documento describe la traducción técnica del **Modelo de Dominio V1** y **Diccionario de Datos Conceptual** al archivo físico de Prisma ORM ubicado en [backend/prisma/schema.prisma](file:///c:/github/potrolearn/backend/prisma/schema.prisma).

---

## 1. Configuración de Datasource y Generador

- **Datasource**: PostgreSQL (`postgresql`).
- **Archivo de Configuración Prisma 7**: [backend/prisma.config.ts](file:///c:/github/potrolearn/backend/prisma.config.ts) con la especificación del esquema `schema: 'prisma/schema.prisma'`.
- **Variables de Entorno**:
  - `DATABASE_URL`: URL de conexión estándar a la base de datos PostgreSQL en Supabase.
  - `DIRECT_URL`: URL de conexión directa para migraciones y pooling en Supabase.
- **Generador**: Prisma Client JS (`prisma-client-js`).

---

## 2. Definición de Enums PostgreSQL (7 Enums)

```prisma
enum Role {
  ADMIN
  TEACHER
  STUDENT
}

enum CourseStatus {
  DRAFT
  ACTIVE
  FINISHED
  ARCHIVED
}

enum EnrollmentStatus {
  ACTIVE
  COMPLETED
  DROPPED
}

enum AssessmentType {
  DIAGNOSTIC
  PRACTICE
  QUIZ
  EXAM
  FINAL
}

enum QuestionType {
  MULTIPLE_CHOICE
  MULTIPLE_SELECT
  TRUE_FALSE
  NUMERIC
  OPEN_TEXT
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  GRADED
}

enum TokenType {
  ACCOUNT_ACTIVATION
  PASSWORD_RESET
}
```

---

## 3. Resumen de Modelos Físicos y Mapeo de Tablas (`@@map`) (17 Modelos)

| Modelo Prisma | Tabla PostgreSQL (`@@map`) | Clave Primaria (`@id`) | Descripción |
| :--- | :--- | :--- | :--- |
| `User` | `users` | `id String @default(uuid())` | Identidad base y credenciales del usuario (`passwordHash String NOT NULL`) |
| `StudentProfile` | `student_profiles` | `id String @default(uuid())` | Matrícula de alumno (1:1 con `User`) |
| `AuthToken` | `auth_tokens` | `id String @default(uuid())` | Tokens de activación y restablecimiento temporal (N:1 con `User`, `@@index([userId, type])`) |
| `Subject` | `subjects` | `id String @default(uuid())` | Materia / Asignatura académica base |
| `Course` | `courses` | `id String @default(uuid())` | Curso o cohorte académica |
| `CourseTeacher` | `course_teachers` | `id String @default(uuid())` | Maestros asignados a un curso (M:N) |
| `Enrollment` | `enrollments` | `id String @default(uuid())` | Inscripción de estudiante en curso (M:N) |
| `Module` | `modules` | `id String @default(uuid())` | Módulo didáctico del curso |
| `Lesson` | `lessons` | `id String @default(uuid())` | Lección o tema individual |
| `LessonProgress` | `lesson_progress` | `id String @default(uuid())` | Registro simplificado de lección leída por alumno |
| `Assessment` | `assessments` | `id String @default(uuid())` | Evaluación o cuestionario |
| `Question` | `questions` | `id String @default(uuid())` | Pregunta o reactivo (banco/examen) |
| `QuestionOption` | `question_options` | `id String @default(uuid())` | Opción de respuesta cerrada |
| `AssessmentQuestion` | `assessment_questions` | `id String @default(uuid())` | Reactivo vinculado a examen con puntaje |
| `Attempt` | `attempts` | `id String @default(uuid())` | Intento de examen por estudiante |
| `Answer` | `answers` | `id String @default(uuid())` | Respuesta emitida por el alumno |
| `AnswerOption` | `answer_options` | `id String @default(uuid())` | Opciones seleccionadas por el alumno |

---

## 4. Estrategia de Mantenimiento de Integridad Histórica (`onDelete`)

| Relación | Regla `onDelete` | Justificación |
| :--- | :--- | :--- |
| `StudentProfile -> User` | `Cascade` | Eliminar el usuario elimina su perfil de estudiante. |
| `AuthToken -> User` | `Cascade` | Eliminar el usuario elimina sus tokens temporales asociados. |
| `Course -> Subject` | `Restrict` | **No permite eliminar una Materia** si existen Cursos asociados. |
| `Course -> User (createdBy)` | `Restrict` | **No permite eliminar un Usuario** que figure como creador de Cursos. |
| `CourseTeacher -> Course` | `Cascade` | Eliminar un Curso remueve sus asignaciones de maestros. |
| `CourseTeacher -> User` | `Restrict` | **No permite eliminar un Usuario** asignado como Maestro activo de un curso. |
| `Enrollment -> User` | `Restrict` | **Protección académica**: No permite eliminar un Alumno si existen registros de inscripción. |
| `Enrollment -> Course` | `Restrict` | **Protección académica**: No permite eliminar un Curso si existen estudiantes inscritos. |
| `Module -> Course` | `Cascade` | Eliminar un Curso remueve sus módulos. |
| `Lesson -> Module` | `Cascade` | Eliminar un Módulo remueve sus lecciones. |
| `LessonProgress -> Enrollment` | `Cascade` | Eliminar la Inscripción remueve su avance acumulado. |
| `LessonProgress -> Lesson` | `Restrict` | **No permite eliminar una Lección** si los alumnos ya registraron lectura. |
| `Assessment -> Course` | `Cascade` | Eliminar un Curso remueve sus evaluaciones. |
| `Assessment -> Module` | `SetNull` | Si se elimina un Módulo, las evaluaciones vinculadas conservan el examen en el Curso, seteando `moduleId = null`. |
| `Assessment -> Lesson` | `SetNull` | Si se elimina una Lección, las evaluaciones vinculadas conservan el examen, seteando `lessonId = null`. |
| `Question -> Subject` | `SetNull` | Si se elimina una Materia del catálogo, los reactivos se conservan desvinculando la materia. |
| `QuestionOption -> Question` | `Cascade` | Eliminar una pregunta remueve sus opciones. |
| `AssessmentQuestion -> Assessment` | `Cascade` | Eliminar un examen remueve sus referencias de preguntas. |
| `AssessmentQuestion -> Question` | `Restrict` | **Protección de reactivos**: No permite borrar una pregunta asignada a un examen activo. |
| `Attempt -> User` | `Restrict` | **Protección histórica**: No permite borrar un alumno si tiene intentos realizados. |
| `Attempt -> Assessment` | `Restrict` | **Protección histórica**: No permite borrar un examen si tiene intentos entregados. |
| `Answer -> Attempt` | `Cascade` | Eliminar un Intento remueve sus respuestas emitidas. |
| `Answer -> Question` | `Restrict` | **Protección histórica**: No permite borrar una Pregunta contestada en un intento. |
| `AnswerOption -> Answer` | `Cascade` | Eliminar una Respuesta remueve sus selecciones. |
| `AnswerOption -> QuestionOption` | `Restrict` | **Protección histórica**: No permite borrar una Opción seleccionada en un intento histórico. |

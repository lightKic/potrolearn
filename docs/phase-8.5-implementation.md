# PotroLearn — Phase 8.5 Implementation
## Gradebook, Ponderaciones & Calificación Final del Curso (Academic Results)

> **Estado oficial:** 🟢 PASS / 100% IMPLEMENTADO Y VALIDADO E2E

---

## 1. Resumen Ejecutivo

La **Fase 8.5** implementa el motor de calificaciones acumuladas y finales de **PotroLearn**, integrando las ponderaciones asignadas a cada evaluación (`Assessment.weight`) con las calificaciones obtenidas en los intentos (`Attempt.score` status = `GRADED`) y consolidándolas en las inscripciones de los estudiantes (`Enrollment.finalGrade`).

Asimismo, incluye la validación de runtime normativa **`UNGRADED_ATTEMPTS_EXIST`** (Decision Gate oficial), impidiendo la transición de un curso a `FINISHED` si existen entregas en estado `SUBMITTED` con preguntas de tipo `OPEN_TEXT` pendientes de calificación manual.

La implementación fue realizada respetando estrictamente las reglas de negocio fijadas en el Design Gate aprobado y sin realizar ninguna modificación al esquema de Prisma ni migraciones a la base de datos (0 cambios de esquema).

---

## 2. Componentes Implementados

### 2.1 Backend

1. **`GradebookService` (`backend/src/services/gradebook.service.ts`)**:
   - `validateCourseWeights(courseId, excludeAssessmentId?, additionalWeight)`: Garantiza que la suma de pesos de evaluaciones publicadas no exceda el 100.00% (retorna `HTTP 400 TOTAL_WEIGHT_EXCEEDED` en caso de exceso).
   - `getTeacherGradebook(courseId, userId, role, statusFilter?, search?)`: Construye la matriz global del libro de calificaciones para Docentes asignados y Administradores, calculando `bestScore` (`MAX(score)` de intentos `GRADED`) y `Current Grade` proporcional normalizado sobre la ponderación calificada a la fecha. Soporta filtros por estado de inscripción y búsqueda por nombre/matrícula.
   - `getStudentGrades(courseId, studentId)`: Genera el reporte individual de calificaciones ("Boleta") para el estudiante autenticado en `req.user.id`, protegiendo el acceso contra vulnerabilidades IDOR.
   - `recalculateAndPersistCourseFinalGrades(courseId, txClient?)`: Recalcula transaccionalmente la calificación final oficial de todos los alumnos inscritos cuando un curso concluye su ciclo académico (`status = FINISHED`), persiste `Enrollment.finalGrade` y actualiza el estado de inscripción a `COMPLETED`.

2. **`GradebookController` (`backend/src/controllers/gradebook.controller.ts`)**:
   - Soporte para parámetros de filtro flexibles `statusFilter` o `status` en el endpoint `GET /api/courses/:courseId/gradebook`.
   - Endpoint `GET /api/courses/:courseId/my-grades`.

3. **`CourseService` (`backend/src/services/course.service.ts`)**:
   - Validante atómico `UNGRADED_ATTEMPTS_EXIST` en `changeCourseStatus` previa a la transición `ACTIVE -> FINISHED`:
     Consulta mediante `tx.attempt.findFirst` si existe algún `Attempt` en estado `SUBMITTED` para el curso con al menos una pregunta `OPEN_TEXT`. Si existe, cancela la transición con `HTTP 400 UNGRADED_ATTEMPTS_EXIST`.
   - Integración transaccional de `recalculateAndPersistCourseFinalGrades` al finalizar un curso.

4. **`AttemptService` (`backend/src/services/attempt.service.ts`)**:
   - Integración transaccional de `recalculateAndPersistCourseFinalGrades` dentro de `gradeAnswer` cuando `course.status === CourseStatus.FINISHED` para reflejar recalificaciones/regrading en la calificación final oficial sin duplicar inscripciones.

5. **Validaciones en `AssessmentService` (`backend/src/services/assessment.service.ts`)**:
   - Invocación de `validateCourseWeights` en la creación, actualización de pesos y publicación de evaluaciones.
   - Verificación de estado de curso en lectura únicamente (`HTTP 400 COURSE_CONTENT_READ_ONLY`) para cursos `FINISHED` o `ARCHIVED`.

---

### 2.2 Frontend

1. **Tipos DTO (`frontend/src/types/gradebook.ts`)**:
   - Interfaces `TeacherGradebookDTO`, `TeacherGradebookStudentItem`, `StudentGradesDTO`, `StudentAssessmentDetailGrade`, `GradebookAssessmentItem`.

2. **Servicio API (`frontend/src/services/gradebook.service.ts`)**:
   - `GradebookServiceAPI.getTeacherGradebook(courseId, { statusFilter, search })`
   - `GradebookServiceAPI.getStudentGrades(courseId)`

3. **Páginas UX (`frontend/src/pages/`)**:
   - **`TeacherGradebookPage.tsx`**: Matriz completa de calificaciones con métricas de cabecera (Ponderación Evaluada %, Estudiantes Inscritos, Estado del Curso), campo de búsqueda rápida, selector de filtro por estado de inscripción, columnas dinámicas por cada evaluación publicada con pesos %, y resaltado de `Current Grade` y `Final Grade`.
   - **`StudentGradesPage.tsx`**: Vista tipo "Boleta" para el alumno con tarjetas de métrica destacada (`Current Grade` y `Final Grade`), listado desglosado por evaluación (Quiz / Examen), aportes en puntos al curso, intentos utilizados vs. disponibles y estado badge (`Calificado`, `Pendiente de revisión`, `Sin realizar`).
   - **`CourseDetailPage.tsx`**: Botones de acceso directo en cabecera ("Libro de Calificaciones (Gradebook)" para Admin/Teacher y "Mis Calificaciones" para Alumnos).
   - **`routes/index.tsx`**: Registro de rutas protegidas mediante `RoleRoute` (`/app/courses/:courseId/gradebook` y `/app/courses/:courseId/my-grades`).

---

## 3. Pruebas de Integración y Verificación

### 3.1 Script de Integración E2E (`backend/scripts/test-phase8.5-integration.ts`)

Se ejecutó la suite completa de pruebas de integración backend obteniendo un resultado de **100% PASS**:

- 🟢 **Ponderaciones & Límites**: Rechazo de creación/publicación que exceda 100% (`TOTAL_WEIGHT_EXCEEDED`).
- 🟢 **Selección de Intento**: Uso estricto de `MAX(score)` entre intentos `GRADED`.
- 🟢 **Current Grade**: Cálculo normalizado proporcional sobre ponderaciones calificadas a la fecha.
- 🟢 **Final Grade Consolidado**: Registro en BD al transicionar curso a `FINISHED` con estado `COMPLETED`.
- 🟢 **Control de Acceso / IDOR**: Restricción de acceso docente no asignado y estudiantes al Gradebook general.
- 🟢 **Cursos Cerrados**: Bloqueo de modificaciones en cursos `FINISHED`/`ARCHIVED`.
- 🟢 **Regrading en Cursos FINISHED**: Recálculo y persistencia automática de `Enrollment.finalGrade` tras recalificación manual.
- 🟢 **Evaluaciones Diagnósticas (weight = 0%)**: Visualización en boleta y gradebook sin alterar ponderaciones del curso.
- 🟢 **Validación UNGRADED_ATTEMPTS_EXIST (Test A)**: Bloqueo de `ACTIVE -> FINISHED` con `HTTP 400 UNGRADED_ATTEMPTS_EXIST` si existen entregas `SUBMITTED` con `OPEN_TEXT`.
- 🟢 **Transición Permitida (Test B)**: `ACTIVE -> FINISHED` exitoso tras calificar todas las preguntas de ensayo.
- 🟢 **Evaluaciones Objetivas (Test C)**: Cierre de curso no bloqueado por evaluaciones puramente objetivas.

### 3.2 Compilación y Typecheck

- Backend `tsc --noEmit`: 🟢 **0 errores**
- Frontend `npm run typecheck`: 🟢 **0 errores**
- Frontend `npm run build`: 🟢 **0 errores** (Next.js build exitoso)

---

## 4. Conclusión

La **Fase 8.5 — Gradebook, Ponderaciones & Calificación Final del Curso** está **100% completada, validada y cerrada**.deraciones & Calificación Final del Curso** está **100% completada y validada**.

# PotroLearn — Post-8.4 Next Phase Design Gate

---

## 1. Executive Summary

Tras el cierre y la **validación End-to-End (E2E) exitosa de la Fase 8.4** (Assessment Engine completo con soporte para inicio/reanudar de intentos, persistencia incremental con autosave debounced, autocalificación objetiva, límites de tiempo con +30s de tolerancia, calificación manual docente con advisory locks y UX completa para Alumnos, Maestros y Administradores), **PotroLearn cuenta con un baseline operativo 100% estable**.

Este documento establece el **Design Gate de la Siguiente Fase del Proyecto**, realizando un inventario exhaustivo del repositorio actual, evaluando la cobertura del flujo académico, analizando las decisiones diferidas y determinando con base en dependencias objetivas cuál debe ser el próximo bloque de desarrollo.

**Recomendación Principal**: La siguiente fase del proyecto debe ser la **Fase 8.5 — Gradebook, Ponderaciones & Calificación Final del Curso (Academic Results)**. Ésta representa la pieza que falta para cerrar el ciclo académico básico (unir las notas individuales de las evaluaciones con la ponderación de la asignatura y generar la calificación final del alumno en el curso), sin introducir sobreingeniería ni romper la estabilidad alcanzada.

---

## 2. Current System State

Actualmente, PotroLearn opera como un LMS funcional desacoplado en dos capas principales:
- **Backend API**: Node.js + Express + Prisma ORM conectado a PostgreSQL en Supabase.
- **Frontend SPA**: React 18 + TypeScript + Vite + React Router v6 con sistema de diseño en Vanilla CSS.

El estado del sistema se caracteriza por:
1. Autenticación robusta basada en JWT en memoria + cookie HttpOnly para refresco de sesión sin vulnerabilidad a XSS en `localStorage`.
2. Control de acceso por roles (`ADMIN`, `TEACHER`, `STUDENT`) validado tanto en React Router (`RoleRoute`) como en middleware backend.
3. Motor de Evaluaciones completamente funcional y probado bajo condiciones de concurrencia intensa (advisory locks de PostgreSQL).

---

## 3. Completed and Validated Features

| Área / Módulo | Estado | Evidencia en Repositorio | Observaciones |
| :--- | :---: | :--- | :--- |
| **Authentication & Tokens** | 🟢 COMPLETE | `src/services/auth.service.ts`, `auth_tokens`, `refresh_sessions` | Login, refresco transparente, activación por invitación, reset de clave y cambio de contraseña. |
| **User & Profile Management** | 🟢 COMPLETE | `src/controllers/admin.controller.ts`, `StudentProfile` | Provisionamiento de usuarios, matriz de 3 roles globales, asignación de matrícula única. |
| **Subjects & Courses** | 🟢 COMPLETE | `src/controllers/course.controller.ts`, `courses`, `course_teachers` | CRUD de materias, creación de cursos en estado `DRAFT`/`ACTIVE`, asignación de maestros. |
| **Enrollment & Excel Import** | 🟢 COMPLETE | `src/controllers/student-import.controller.ts`, `enrollments` | Inscripción manual e importación masiva por Excel con generación de invitaciones. |
| **Pedagogical Content** | 🟢 COMPLETE | `src/controllers/content.controller.ts`, `modules`, `lessons` | Módulos y lecciones con ordenamiento, publicación y renderizado seguro de Markdown. |
| **Assessment Engine (8.4-A → 8.4-E)** | 🟢 COMPLETE | `src/services/attempt.service.ts`, `test-phase8.4*-integration.ts` | Banco de preguntas, autocalificación, timer UTC, grace period +30s, calificación manual `OPEN_TEXT`, regrading y locks atómicos. |
| **Student Assessment UX (8.4-F)** | 🟢 COMPLETE | `frontend/src/pages/ExamTakePage.tsx`, `ExamTimer.tsx` | Reproductor de exámenes, navegables por teclado, autosave debounced, recuperación ante F5. |
| **Teacher/Admin Review UX (8.4-F)** | 🟢 COMPLETE | `frontend/src/pages/TeacherGradingListPage.tsx`, `TeacherAttemptReviewPage.tsx` | Centro de calificación, filtro por entregas pendientes, formulario de notas y feedback. |

---

## 4. Partial / Pending Features

| Área / Módulo | Estado | Evidencia en Repositorio | Gaps Identificados |
| :--- | :---: | :--- | :--- |
| **Lesson Progress** | 🟡 PARTIAL | `LessonProgress` model, `LessonDetailPage.tsx` | Registra lecturas individuales de lecciones, pero no consolida el porcentaje global de avance del módulo/curso. |
| **Course Lifecycle** | 🟡 PARTIAL | `CourseStatus` enum (`DRAFT`, `ACTIVE`, `FINISHED`, `ARCHIVED`) | La base de datos soporta los estados, pero el frontend no tiene botones de transición de estado del curso (`ACTIVE` $\rightarrow$ `FINISHED`). |

---

## 5. Explicitly Deferred Features

Las siguientes funcionalidades fueron diferidas en fases de diseño previas y **permanecen fuera del alcance actual**:
- **Almacenamiento de Archivos Multimedia / Google Drive**: Subida directa de archivos PDF/Imágenes (se utiliza Markdown y URLs/Payloads de texto).
- **Banco de Preguntas Avanzado con Taxonomía**: Categorización por dificultad, tags, temas y versión de reactivos (`QuestionVersion`).
- **Preguntas Aleatorias (Random Question Draw)**: Selección aleatoria de preguntas por intento.
- **Multitenancy Orgánico / Auto-registro**: Registro público sin invitación previa.
- **Penalizaciones por Entrega Tardía**: Reglas de descuento automatizado por tiempo.
- **Deployment Automatizado en Producción**: Infraestructura CI/CD y despliegue en la nube.

---

## 6. Academic Workflow Coverage

El flujo académico básico de un LMS consta del siguiente ciclo de vida:

```text
┌────────────────┐     ┌────────────────┐     ┌──────────────────┐
│   ADMIN/DOCENTE │     │   ESTUDIANTE   │     │    EVALUACIÓN    │
│  Crea materia, │────>│  Se activa,    │────>│   El estudiante  │
│  curso, módulos│     │  lee lecciones │     │   resuelve y     │
│  y evaluaciones│     │  y contenido   │     │   recibe nota    │
└────────────────┘     └────────────────┘     └─────────┬────────┘
                                                        │
                                                        ▼
┌────────────────┐     ┌────────────────┐     ┌──────────────────┐
│ CURSO COMPLETO │     │  CENTRO DE     │     │  CALIFICACIÓN    │
│ El estudiante  │<────│  CALIFICACIONES│<────│  FINAL DEL CURSO │
│ obtiene estado │     │  (GRADEBOOK)   │     │ Ponderación acumulada│
│ final          │     │  Consolidado   │     │ según pesos      │
└────────────────┘     └────────────────┘     └──────────────────┘
```

**Análisis del Flujo Actual**:
Actualmente, el sistema permite ejecutar con total éxito los pasos 1 al 3. Sin embargo, existe una **ruptura en el paso 4 y 5**: aunque la base de datos almacena el peso de cada evaluación (`Assessment.weight`) y contiene la columna `Enrollment.finalGrade`, **no existe la lógica backend ni la interfaz frontend para consolidar las calificaciones del curso**. El estudiante únicamente ve notas aisladas de exámenes individuales y el profesor no dispone de una lista consolidada con el promedio o calificación acumulada de sus alumnos.

---

## 7. Pilot Readiness Analysis

Para llevar a cabo una primera prueba piloto controlada con usuarios y profesores reales en un entorno académico, se requiere:

### Requisitos Indispensables para Piloto (Must Have):
1. **Gradebook / Boleta de Calificaciones del Curso**: Un resumen consolidado donde el profesor vea el avance y nota acumulada de cada alumno y el alumno consulte su promedio ponderado del curso.
2. **Cierre/Conclusión del Curso**: Capacidad de calcular `finalGrade` y marcar la inscripción como `COMPLETED`.
3. **Ponderación de Evaluaciones**: Validación de que la suma de los pesos de las evaluaciones publicadas alcance el 100% (o se normalice correctamente).

### Requisitos Diferidos para el Piloto (Nice to Have / V2):
- Analíticas avanzadas de discriminación de preguntas (Índice de Hake).
- Gráficas complejas de rendimiento acumulado.
- Exportación a PDF de constancias de aprobación.

---

## 8. Technical Risks

### Riesgos Confirmados (Confirmed Technical Debt):
1. **Ponderación `Assessment.weight` No Validada**: En la Fase 8.3 se definió el campo `weight` en la tabla `assessments`, pero actualmente el sistema permite crear evaluaciones con cualquier peso sin validar si la suma del curso excede o no el 100%.
2. **Inexistencia de Recálculo de `finalGrade`**: Ningún endpoint actualiza la columna `Enrollment.finalGrade` cuando un intento cambia a estado `GRADED` o cuando el profesor modifica una nota manual en un regrading.

### Riesgos Potenciales (Potential Risks):
- **Consultas N+1 en Boletas Extensas**: Si no se estructuran adecuadamente las consultas Prisma al listar las notas de todos los alumnos de un curso con múltiples evaluaciones, la latencia de respuesta en la vista del Gradebook podría elevarse.

---

## 9. Security Review

- **Autorización por Curso**: La lógica de autorización debe garantizar que un docente sólo pueda visualizar o editar el Gradebook de los cursos a los cuales está asignado en `CourseTeacher`.
- **Protección de Datos Estudiantiles (IDOR)**: Un alumno con rol `STUDENT` únicamente debe poder consultar su propia boleta de calificaciones en `/app/courses/:courseId/my-grades`. Intentar ingresar al ID de otro estudiante debe retornar `403 FORBIDDEN`.
- **Inmutabilidad de Registro**: Los alumnos no pueden alterar pesos ni notas calculadas. La fuente de verdad radica en el backend.

---

## 10. Data Model Assessment

**Evaluación del Esquema de Prisma (`backend/prisma/schema.prisma`)**:
El modelo de datos actual de PotroLearn **ES 100% SUFICIENTE** para soportar el módulo de Gradebook y Calificaciones Consolidadas.

Campos existentes listos para ser utilizados sin modificar el esquema:
- **`Assessment.weight`**: `Decimal @default(0.0) @db.Decimal(5, 2)` (Almacena el porcentaje o peso relativo de la evaluación dentro del curso).
- **`Enrollment.finalGrade`**: `Decimal? @db.Decimal(5, 2)` (Almacena el promedio/calificación final calculada del alumno en la asignatura).
- **`Attempt.score`**: `Decimal? @db.Decimal(5, 2)` (Nota obtenida en la evaluación sobre 100).
- **`Attempt.status`**: `AttemptStatus` (`IN_PROGRESS`, `SUBMITTED`, `GRADED`).

> [!NOTE]
> **NO SE REQUIEREN NUEVAS TABLAS NI MIGRACIONES DE PRISMA**. El modelo fue diseñado desde el inicio contemplando este soporte.

---

## 11. Candidate Next Phases

Se evaluaron 4 candidatos para la siguiente fase de desarrollo:

### Candidato A — Gradebook & Academic Results (Recomendado)
- **Objetivo**: Implementar el cálculo de notas ponderadas del curso, la boleta de calificaciones para el estudiante y la sábana de notas consolidada para el profesor.
- **Impacto**: Completa el flujo académico básico de PotroLearn (Paso 4 del flujo).
- **Dependencias**: Depende 100% de la Fase 8.4 (Assessment Engine completado).
- **Cambios en DB**: NINGUNO (Usa schema existente).

### Candidato B — Progress & Visual Analytics
- **Objetivo**: Crear tableros de control con gráficas de rendimiento, progreso por lección y estadísticas por grupo.
- **Impacto**: Aporta valor visual pero depende de tener primero las calificaciones consolidadas (Candidato A).
- **Dependencias**: Requiere Gradebook previamente funcional.

### Candidato C — Advanced Content Management & Course Duplication
- **Objetivo**: Permitir la clonación completa de un curso para un nuevo periodo académico.
- **Impacto**: Útil para la operación recurrente, pero no bloquea una primera prueba piloto con un solo curso.

### Candidato D — Infrastructure & Pilot Deployment
- **Objetivo**: Configuración de servidores de producción, dominio y pipelines CI/CD.
- **Impacto**: Necesario para lanzar el software a internet, pero prematuro si el flujo académico funcional aún no está cerrado.

---

## 12. Recommended Next Phase

Se determina que la siguiente fase oficial debe ser:

### 🟢 FASE 8.5 — GRADEBOOK, PONDERACIONES & CALIFICACIÓN FINAL DEL CURSO

**Justificación basada en Dependencias**:
1. **Continuidad Natural**: Tras resolver cómo se realizan y califican los exámenes (Fase 8.4), el paso lógico indispensable es determinar cómo esas notas alimentan la calificación global del estudiante en la materia (Fase 8.5).
2. **Cero Cambios de Esquema**: Utiliza los campos `weight` y `finalGrade` que ya existen en PostgreSQL, evitando complejidad o riesgo de migración.
3. **Desbloqueo del Piloto**: Es la última pieza funcional requerida para poder realizar un piloto real donde un profesor pueda emitir un promedio final a sus alumnos.

---

## 13. Proposed Scope (Fase 8.5)

La Fase 8.5 abarcará los siguientes componentes:

### 1. Backend Service & Logic (`gradebook.service.ts`)
- Cálculo del promedio acumulado por estudiante en un curso considerando únicamente evaluaciones publicadas en estado `GRADED` (tomando el intento con mayor puntaje del alumno o el más reciente según la regla académica configurada).
- Fórmula de ponderación:
  $$\text{finalGrade} = \frac{\sum \left( \text{bestScore}_i \times \text{weight}_i \right)}{\sum \text{weight}_i}$$
- Endpoint `GET /api/courses/:courseId/gradebook` (Exclusivo `TEACHER` y `ADMIN`): Lista todos los alumnos inscritos con sus notas por evaluación y calificación final acumulada.
- Endpoint `GET /api/courses/:courseId/my-grades` (Exclusivo `STUDENT`): Muestra la boleta individual del alumno autenticado.
- Recálculo automático de `Enrollment.finalGrade` en backend al publicarse una nota manual o completarse un examen.

### 2. Frontend UX
- **`TeacherGradebookPage.tsx`**: Sábana de notas estilo hoja de cálculo para el profesor con exportación o vista clara de promedios.
- **`StudentGradesPage.tsx`**: Vista tipo boleta académica para el estudiante con el desglose de sus exámenes, calificaciones obtenidas, pesos y calificación final del curso.

---

## 14. Explicit Non-Goals (Fase 8.5)

En la Fase 8.5 **NO SE IMPLEMENTARÁ**:
- ❌ Integración con Google Drive ni subida de archivos locales.
- ❌ Gráficas complejas de analíticas (Charts/Recharts).
- ❌ Cálculo del Índice de Hake o métricas de discriminación de reactivos.
- ❌ Modificaciones al esquema de Prisma o migraciones de base de datos.
- ❌ Despliegue en servidores de producción / Render / Netlify.

---

## 15. Required Design Gate Decisions

Antes de iniciar la codificación de la Fase 8.5, se deberá definir en el prompt de Design Gate de 8.5:
1. **Criterio de Selección de Intento**: Si un alumno realiza múltiples intentos en un quiz/examen, ¿se utiliza para el Gradebook el **puntaje más alto** (Best Score) o el **último intento** (Latest Attempt)? *(Recomendación: Puntaje más alto / Best Score)*.
2. **Evaluaciones con Ponderación Incompleta**: Si la suma de las evaluaciones publicadas es menor al 100% (ej. 60%), ¿el promedio actual se calcula escalado al 100% de lo evaluado o sobre el total absoluto del curso?

---

## 16. Proposed Test Strategy

- **Integration Tests**: Script de prueba `test-phase8.5-gradebook-integration.ts` que simule la resolución de múltiples evaluaciones por varios alumnos y verifique el cálculo decimal exacto de `finalGrade`.
- **Security & Authorization**: Verificación de rechazo de IDOR en `/my-grades` e inspección de docentes en cursos no asignados.
- **Frontend Regression**: Verificación de `npm run typecheck`, `npm run lint` y `npm run build`.

---

## 17. Proposed Acceptance Criteria

1. El profesor puede ingresar al Gradebook de su curso y ver la lista completa de alumnos con sus calificaciones por evaluación y su promedio final acumulado.
2. El alumno puede consultar su boleta personal de calificaciones sin poder ver los datos de otros compañeros.
3. El cálculo de `finalGrade` se actualiza de forma automática e idempotente en la base de datos tras la calificación de un examen o una revisión manual.
4. `npm run typecheck`, `npm run lint` y `npm run build` finalizan con 0 errores.

---

## 18. Roadmap After Next Phase

```text
Fase 8.4: Assessment Engine & UX (🟢 COMPLETO)
       │
       ▼
Fase 8.5: Gradebook & Calificación Final (🎯 SIGUIENTE FASE PROPUESTA)
       │
       ▼
Fase 8.6: Analíticas y Métricas de Progreso (Visual Dashboard)
       │
       ▼
Fase 9.0: Prep y Despliegue para Prueba Piloto (Production Readiness)
```

---

## 19. Open Questions

- Ninguna pregunta bloqueante para el cierre de la arquitectura actual.

---

## DESIGN GATE STATUS: PASS 🟢
El análisis de arquitectura Post-8.4 y la propuesta de diseño para la **Fase 8.5 (Gradebook & Academic Results)** se encuentran **cerrados y listos para ser presentados al usuario**.

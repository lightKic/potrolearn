# Assessment Engine V1 — Technical Design

Documento de diseño técnico y especificación de arquitectura para el **Assessment Engine V1** de PotroLearn.

---

## 1. Objetivo

El objetivo de la Fase 8 es diseñar la especificación técnica para permitir que los profesores (`TEACHER`) y administradores (`ADMIN`) construyan, configuren y gestionen evaluaciones y actividades dentro de los cursos de PotroLearn, y que los alumnos (`STUDENT`) inscritos puedan realizarlas, responderlas y consultar sus resultados académicos.

El diseño debe integrarse de forma nativa sobre el modelo de dominio y la arquitectura de autenticación/autorización existente sin degradar la seguridad ni alterar las reglas funcionales de las fases previas.

---

## 2. Estado Actual de Clasificación

A partir de la inspección física del repositorio y de la base de datos PostgreSQL, la clasificación del Assessment Engine es:

| Componente | Estado Real | Descripción |
| :--- | :--- | :--- |
| **Prisma Schema (`Assessment`, `Question`, etc.)** | `YA IMPLEMENTADO` | Los modelos de datos (`Assessment`, `Question`, `QuestionOption`, `AssessmentQuestion`, `Attempt`, `Answer`, `AnswerOption`) y sus enums existen físicamente en `prisma/schema.prisma`. |
| **Tablas PostgreSQL** | `YA IMPLEMENTADO` | Las tablas físicas (`assessments`, `questions`, `question_options`, `assessment_questions`, `attempts`, `answers`, `answer_options`) ya fueron creadas por la migración inicial (`20260911184000_init`). |
| **Validaciones CRUD de BD (`test-crud.ts`)** | `YA IMPLEMENTADO` | Existen scripts de prueba en `backend/scripts/test-crud.ts` que confirman la inserción y consulta exitosa de registros en estas tablas. |
| **Backend Controllers (`AssessmentController`)** | `NO EXISTE` | No existen controladores ni endpoints HTTP para gestionar o realizar evaluaciones en `backend/src/controllers/`. |
| **Backend Services (`AssessmentService`)** | `NO EXISTE` | No existe lógica de negocio ni motores de calificación en `backend/src/services/`. |
| **Backend Routes (`/api/assessments`, `/api/attempts`)** | `NO EXISTE` | No hay rutas declaradas en `backend/src/routes/`. |
| **Frontend UI (Editor / Player / Results)** | `NO EXISTE` | No existen componentes React, páginas ni servicios de API en `frontend/src/`. |

---

## 3. Entidades Existentes en PostgreSQL / Prisma

Las 7 entidades del dominio de evaluaciones ya existen en `backend/prisma/schema.prisma` con la siguiente estructura física exacta:

### 3.1. `Assessment` (`assessments`)
- `id`: `String` (UUID, Primary Key)
- `courseId`: `String` (Foreign Key → `courses.id`, `onDelete: Cascade`, Indexado)
- `moduleId`: `String?` (Foreign Key → `modules.id`, `onDelete: SetNull`, Indexado)
- `lessonId`: `String?` (Foreign Key → `lessons.id`, `onDelete: SetNull`, Indexado)
- `title`: `String`
- `description`: `String?` (`Text`)
- `type`: `AssessmentType` (Enum: `DIAGNOSTIC`, `PRACTICE`, `QUIZ`, `EXAM`, `FINAL`)
- `weight`: `Decimal` (`default: 0.00`, `@db.Decimal(5, 2)`) — Ponderación dentro de la calificación del curso (0-100%).
- `availableFrom`: `DateTime?` — Timestamp de inicio de disponibilidad para iniciar intentos.
- `availableUntil`: `DateTime?` — Timestamp límite para iniciar nuevos intentos y referencia temporal para derivar entregas tardías.
- `timeLimitMinutes`: `Int?` — Límite de tiempo en minutos por intento desde `startedAt`.
- `maxAttempts`: `Int?` — Límite de intentos (`null` = ilimitados).
- `passingScore`: `Decimal?` (`@db.Decimal(5, 2)`) — Calificación mínima aprobatoria.
- `isPublished`: `Boolean` (`default: false`) — Publicación/Visibilidad para el alumno.
- `createdAt`: `DateTime` (`default: now()`)
- `updatedAt`: `DateTime` (`updatedAt`)

### 3.2. `Question` (`questions`)
- `id`: `String` (UUID, Primary Key)
- `subjectId`: `String?` (Foreign Key → `subjects.id`, `onDelete: SetNull`, Indexado) — Permite asociar reactivos a la materia general para reutilización.
- `statement`: `String` (`Text`) — Enunciado de la pregunta (Soporta Markdown + KaTeX).
- `type`: `QuestionType` (Enum: `MULTIPLE_CHOICE`, `MULTIPLE_SELECT`, `TRUE_FALSE`, `NUMERIC`, `OPEN_TEXT`)
- `defaultPoints`: `Decimal` (`default: 10.00`, `@db.Decimal(5, 2)`) — Puntos por defecto del reactivo.
- `explanation`: `String?` (`Text`) — Retroalimentación o solución explicada.
- `createdAt`: `DateTime` (`default: now()`)
- `updatedAt`: `DateTime` (`updatedAt`)

### 3.3. `QuestionOption` (`question_options`)
- `id`: `String` (UUID, Primary Key)
- `questionId`: `String` (Foreign Key → `questions.id`, `onDelete: Cascade`)
- `text`: `String` (`Text`) — Texto de la opción (Soporta Markdown + KaTeX).
- `isCorrect`: `Boolean` — Indica si la opción es correcta.
- `explanation`: `String?` (`Text`) — Retroalimentación específica por opción.
- `order`: `Int` — Orden visual de presentación.

### 3.4. `AssessmentQuestion` (`assessment_questions`)
- `id`: `String` (UUID, Primary Key)
- `assessmentId`: `String` (Foreign Key → `assessments.id`, `onDelete: Cascade`)
- `questionId`: `String` (Foreign Key → `questions.id`, `onDelete: Restrict`)
- `points`: `Decimal` (`@db.Decimal(5, 2)`) — Puntos asignados a esta pregunta en ESTA evaluación específica.
- `order`: `Int` — Posición dentro de la evaluación.
- **Constraints**: `@@unique([assessmentId, questionId])`

### 3.5. `Attempt` (`attempts`)
- `id`: `String` (UUID, Primary Key)
- `studentId`: `String` (Foreign Key → `users.id`, `onDelete: Restrict`, Indexado)
- `assessmentId`: `String` (Foreign Key → `assessments.id`, `onDelete: Restrict`, Indexado)
- `attemptNumber`: `Int` — Número ordinal del intento para ese alumno en esa evaluación (1, 2, 3...).
- `startedAt`: `DateTime` (`default: now()`) — Timestamp de inicio del intento.
- `submittedAt`: `DateTime?` — Timestamp de entrega/finalización del intento.
- `score`: `Decimal?` (`@db.Decimal(5, 2)`) — Calificación obtenida (0.00 - 100.00).
- `status`: `AttemptStatus` (Enum: `IN_PROGRESS`, `SUBMITTED`, `GRADED`, `default: IN_PROGRESS`)
- `createdAt`: `DateTime` (`default: now()`)
- `updatedAt`: `DateTime` (`updatedAt`)
- **Constraints**: `@@unique([studentId, assessmentId, attemptNumber])`

### 3.6. `Answer` (`answers`)
- `id`: `String` (UUID, Primary Key)
- `attemptId`: `String` (Foreign Key → `attempts.id`, `onDelete: Cascade`, Indexado)
- `questionId`: `String` (Foreign Key → `questions.id`, `onDelete: Restrict`)
- `numericValue`: `Decimal?` (`@db.Decimal(10, 4)`) — Valor registrado para preguntas de tipo `NUMERIC`.
- `textValue`: `String?` (`Text`) — Respuesta libre para preguntas `OPEN_TEXT`.
- `pointsEarned`: `Decimal?` (`@db.Decimal(5, 2)`) — Puntos obtenidos en la pregunta.
- `isCorrect`: `Boolean?` — Resultado booleano de la evaluación del reactivo.
- `feedback`: `String?` (`Text`) — Retroalimentación personalizada del docente.
- `gradedAt`: `DateTime?` — Timestamp de calificación manual o automática.
- **Constraints**: `@@unique([attemptId, questionId])`

### 3.7. `AnswerOption` (`answer_options`)
- `id`: `String` (UUID, Primary Key)
- `answerId`: `String` (Foreign Key → `answers.id`, `onDelete: Cascade`)
- `optionId`: `String` (Foreign Key → `question_options.id`, `onDelete: Restrict`)
- **Constraints**: `@@unique([answerId, optionId])`

---

## 4. Relaciones de Dominio

```text
Course (1) ─────────── (N) Assessment
  │                            │ (1)
  │                            │
  ├── (0..1) Module ───────────┤ (N)
  │                            │
  └── (0..1) Lesson ───────────┘ (N)
                               │ (1)
                               │
                       AssessmentQuestion (N) ─── (1) Question (1) ─── (N) QuestionOption
                               │                                           │
                               │                                           │
User/Student (1) ────── (N) Attempt (1) ── (N) Answer (1) ──────── (N) AnswerOption
```

---

## 5. Tipos de Assessment

| Tipo Enum | Propósito | Intentos Típicos | Ponderación Típica | Autocalificable |
| :--- | :--- | :--- | :--- | :--- |
| `DIAGNOSTIC` | Evaluación de conocimientos previos (Pre-test) al iniciar el curso. | 1 | 0.00% (No cuenta para promedio) | Sí |
| `PRACTICE` | Cuestionario formativo sin presión para reforzamiento de lecciones. | Ilimitados (`maxAttempts = null`) | 0.00% o bajo peso | Sí |
| `QUIZ` | Evaluación corta de control de lectura al finalizar un módulo. | 1 - 3 | Peso moderado (ej. 10-20%) | Sí |
| `EXAM` | Evaluación sumativa parcial al finalizar unidades temáticas. | 1 | Peso elevado (ej. 30-50%) | Mixta (si incluye `OPEN_TEXT`) |
| `FINAL` | Evaluación sumativa global del curso (Post-test para Hake gain). | 1 | Peso principal (ej. 40-50%) | Mixta |

---

## 6. Tipos de Pregunta y Evaluación

| Tipo Pregunta | Una Opción | Varias Opciones | Autocalificable | Mecanismo de Evaluación |
| :--- | :---: | :---: | :---: | :--- |
| `MULTIPLE_CHOICE` | Sí | No | **Sí** | Compara la `optionId` seleccionada con `QuestionOption.isCorrect = true`. |
| `MULTIPLE_SELECT` | No | Sí | **Sí** | Requiere que el conjunto exacto de `optionId`s seleccionadas coincida con TODAS las opciones con `isCorrect = true` (sin omisiones ni extras). |
| `TRUE_FALSE` | Sí | No | **Sí** | Caso especial de `MULTIPLE_CHOICE` con 2 opciones ("Verdadero" / "Falso"). |
| `NUMERIC` | N/A | N/A | **Sí** | Compara `numericValue` contra la respuesta correcta con tolerancia estricta (ej. `|val - target| <= 0.0001`). |
| `OPEN_TEXT` | N/A | N/A | **No** (Manual) | El alumno envía `textValue`. Requiere que el docente revise, asigne `pointsEarned` y marque `gradedAt`. |

---

## 7. Flujo del Maestro (`TEACHER` / `ADMIN`)

```text
Entrar al Curso
  ↓
Sección "Evaluaciones" → [+ Nueva Evaluación]
  ↓
Configurar datos (Título, Tipo, Peso, Fechas, Intentos, Límite de tiempo, Puntaje aprobatorio)
  ↓
Agregar Reactivos (Crear nueva pregunta o seleccionar del Banco de la Materia)
  ↓
Asignar Puntos específicos (AssessmentQuestion.points) y Ordenamiento
  ↓
Publicar Evaluación (isPublished = true)
  ↓
Consultar Resultados (Respuestas de alumnos, calificación manual de OPEN_TEXT, estadísticas)
```

---

## 8. Flujo del Alumno (`STUDENT`)

```text
Entrar al Curso Inscrito
  ↓
Ver Evaluaciones Publicadas y Disponibles (availableFrom <= now <= availableUntil)
  ↓
Seleccionar Evaluación → [Iniciar Intento]
  ↓
Backend crea Attempt (status = IN_PROGRESS, attemptNumber = N+1)
  ↓
Responder preguntas (Respuestas guardadas automáticamente de forma incremental)
  ↓
Pulsar [Entregar Evaluación]
  ↓
Backend valida límite de tiempo y fechas → Transacción atómica de entrega
  ↓
Evaluación automática de reactivos cerrados → Si no hay OPEN_TEXT: status = GRADED, score = X
                                           → Si incluye OPEN_TEXT: status = SUBMITTED (Pendiente de revisión)
  ↓
Ver Pantalla de Resultados / Retroalimentación
```

---

## 9. Manejo de Intentos (`Attempt`)

### 9.1. Reglas de Negocio
1. **Límite de Intentos**: Si `maxAttempts != null`, el backend rechaza la creación de un nuevo intento cuando los intentos existentes del alumno alcancen o superen `maxAttempts`.
2. **Intento Único en Progreso**: Un alumno NO puede tener más de un `Attempt` con `status = IN_PROGRESS` simultáneamente para la misma evaluación. Si reconecta o recarga (F5), se le retorna el intento `IN_PROGRESS` activo.
3. **Puntuación Válida**: Cuando existen múltiples intentos finalizados, la calificación del `Assessment` se determina según la política del curso (por defecto: el intento con la calificación más alta `max(score)` de los intentos `GRADED`).

---

## 10. Algoritmo de Calificación

### 10.1. Cálculo de Puntos por Reactivo
Para cada pregunta en la evaluación:
- **`MULTIPLE_CHOICE` / `TRUE_FALSE`**:
  - Si la opción elegida tiene `isCorrect = true` $\rightarrow$ `pointsEarned = AssessmentQuestion.points`, `isCorrect = true`.
  - En caso contrario $\rightarrow$ `pointsEarned = 0.00`, `isCorrect = false`.
- **`MULTIPLE_SELECT`**:
  - Se obtienen las opciones seleccionadas en `AnswerOption`.
  - Si coincide exactamente con el conjunto de opciones correctas $\rightarrow$ `pointsEarned = AssessmentQuestion.points`, `isCorrect = true`.
  - En caso contrario $\rightarrow$ `pointsEarned = 0.00`, `isCorrect = false`.
- **`NUMERIC`**:
  - Se evalúa `numericValue`. Si satisface la igualdad con tolerancia $\rightarrow$ `pointsEarned = AssessmentQuestion.points`, `isCorrect = true`.
- **`OPEN_TEXT`**:
  - `pointsEarned = null`, `isCorrect = null`, `gradedAt = null`.
  - El estado del intento se establece en `SUBMITTED`.

### 10.2. Cálculo del Score Total
$$\text{TotalPointsEarned} = \sum \text{pointsEarned}$$
$$\text{TotalMaxPoints} = \sum \text{AssessmentQuestion.points}$$
$$\text{score} = \left( \frac{\text{TotalPointsEarned}}{\text{TotalMaxPoints}} \right) \times 100.00$$

---

## 11. Fechas y Disponibilidad (Semántica Definitiva V1)

```text
                  ASSESSMENT
                      │
          ┌───────────┼────────────┐
          │           │            │
          ▼           ▼            ▼
 availableFrom   availableUntil   timeLimitMinutes
      │                │                 │
      ▼                ▼                 ▼
 cuándo puede     cuándo deja de     cuánto dura
 iniciar          iniciar nuevos     cada intento
 un intento       intentos           iniciado
                      │
                      ▼
                 isLate derivado
             submittedAt > availableUntil
```

1. **`availableFrom`**: Determina el instante a partir del cual el alumno puede **iniciar un nuevo intento** (`now >= availableFrom`). NO representa una fecha límite de entrega.
2. **`availableUntil`**: Determina el cierre de la ventana para **iniciar nuevos intentos** (`now <= availableUntil`).
   - El hecho de que `now > availableUntil` **NO cancela automáticamente** un intento `IN_PROGRESS` que ya fue iniciado legítimamente antes del cierre.
3. **`timeLimitMinutes`**: Determina la duración máxima de un intento desde `Attempt.startedAt`.
   - `timeLimitMinutes` es independiente de `availableUntil`.
   - El auto-submit por expiración del tiempo del intento está asociado a `startedAt + timeLimitMinutes (+ buffer)`, NO a `availableUntil`.
4. **Ausencia de `dueDate` separado**: En V1 no se agrega una columna `dueDate` a PostgreSQL. `availableUntil` cumple simultáneamente la función de ventana de inicio y de referencia temporal para derivar entregas tardías.

---

## 12. Entregas Tardías y Ejemplos Definitivos

Las entregas tardías están **PERMITIDAS** en V1. La condición `isLate = submittedAt > availableUntil` es un **estado derivado dinámicamente** (NO se agrega ninguna columna `isLate` a PostgreSQL). La evaluación NO se rechaza únicamente por ocurrir después de `availableUntil`.

### Ejemplos Definitivos V1:

- **Caso A — Entrega Normal**:
  - `availableUntil`: 20/09/2026 23:59 | `startedAt`: 20/09/2026 20:00 | `submittedAt`: 20/09/2026 22:30
  - **Resultado**: Entregada normalmente (`isLate = false`).
- **Caso B — Entrega Tardía**:
  - `availableUntil`: 20/09/2026 23:59 | `startedAt`: 20/09/2026 20:00 | `submittedAt`: 21/09/2026 00:15
  - **Resultado**: Entregada con retraso (`isLate = true`). Se califica y registra normalmente.
- **Caso C — Intento Iniciado Antes del Cierre**:
  - `availableUntil`: 20/09/2026 23:59 | `startedAt`: 20/09/2026 23:50 | `timeLimitMinutes`: 30
  - **Resultado**: El alumno puede continuar su intento hasta las 00:20 del 21/09/2026. `availableUntil` NO cancela ese intento `IN_PROGRESS`.
- **Caso D — Intento Nuevo Después del Cierre**:
  - `availableUntil`: 20/09/2026 23:59 | `now`: 21/09/2026 08:00
  - **Resultado**: Intento de inicio **RECHAZADO**. No se crea ningún nuevo `Attempt`.
- **Caso E — Sin Límite de Tiempo (`timeLimitMinutes = null`)**:
  - El intento no tiene cronómetro propio. `availableUntil` continúa controlando el inicio de nuevos intentos y la derivación de `isLate`.

---

## 13. Estrategia de Integridad Histórica

### Decisión Aprobada: Opción A (Bloqueo de Cambios Destructivos)
- Una vez que un `Assessment` posee al menos un `Attempt` en estado `SUBMITTED` o `GRADED`:
  - **NO se permite**: Eliminar preguntas del reactivo, cambiar la opción correcta de preguntas cerradas o alterar `AssessmentQuestion.points`.
  - **SÍ se permite**: Editar erratas ortográficas o explicaciones que no alteren la validez conceptual de la respuesta.
- Si el docente requiere hacer cambios estructurales mayores a una evaluación con intentos existentes, la plataforma sugerirá duplicar la evaluación como una nueva versión.

---

## 14. Regla de Precedencia Conceptual para Intentos

Para cualquier petición de intento o entrega, el backend aplicará las reglas en el siguiente orden conceptual:

```text
1. Usuario autenticado (req.user existe)
        ↓
2. Alumno inscrito en el curso (Enrollment.status = ACTIVE)
        ↓
3. Assessment pertenece al curso (Assessment.courseId match)
        ↓
4. Assessment publicado/disponible (isPublished = true)
        ↓
5. availableFrom (now >= availableFrom)
        ↓
6. availableUntil para NUEVOS intentos (now <= availableUntil para iniciar)
        ↓
7. Límite maxAttempts (count(Attempts) < maxAttempts)
        ↓
8. Buscar Attempt IN_PROGRESS existente (si existe, retornar/continuar)
        ↓
9. timeLimitMinutes (validar cronómetro startedAt + timeLimitMinutes)
        ↓
10. Guardar respuestas / Entregar (atomic submit & auto-grading)
```

---

## 15. Autorización y Seguridad

### 15.1. Reglas de Autorización por Rol
- **`ADMIN`**: Acceso total de lectura y administración sobre cualquier evaluación.
- **`TEACHER`**:
  - Puede crear, editar, publicar y calificar evaluaciones **únicamente** en cursos donde esté asignado en `CourseTeacher`.
  - Se valida el ownership del curso desde la base de datos en cada request.
- **`STUDENT`**:
  - Puede consultar evaluaciones **únicamente** en cursos donde esté inscrito (`Enrollment.status = ACTIVE`).
  - Solo puede ver preguntas de evaluaciones donde `isPublished = true` y `availableFrom <= now`.
  - **Jamás** puede recibir el atributo `isCorrect` de las opciones antes ni durante la realización del intento.

### 15.2. Prevención de Vulnerabilidades
- **IDOR**: Todos los accesos a `Attempt` y `Answer` verifican que `Attempt.studentId === req.user.id` (para alumnos) o que el docente esté asignado al curso.
- **Cálculo de Score**: El cliente `STUDENT` nunca envía el `score`. El `score` es computado exclusivamente por el servidor.
- **XSS**: Todos los enunciados, opciones y respuestas textuales son saneadas con `DOMPurify` / `isomorphic-dompurify` antes de ser renderizados con Markdown/KaTeX.

---

## 16. Arquitectura Backend Propuesta (Fase 8.2 en adelante)

Servicios futuros a crear:
- **`AssessmentService`**: CRUD de evaluaciones, asociación de reactivos y control de publicación.
- **`QuestionService`**: Banco de preguntas por materia y gestión de opciones.
- **`AttemptService`**: Creación de intentos, registro incremental de respuestas y entrega.
- **`GradingService`**: Motor atómico de calificación y revisión docente.

---

## 17. Arquitectura Frontend Propuesta (Fase 8.6 / 8.7 en adelante)

Nuevas páginas y componentes a crear:
- `frontend/src/pages/AssessmentListPage.tsx` (Lista de evaluaciones del curso)
- `frontend/src/pages/AssessmentEditorPage.tsx` (Editor docente de evaluaciones y preguntas)
- `frontend/src/pages/AssessmentPlayerPage.tsx` (Reproductor de examen para el alumno)
- `frontend/src/pages/AttemptResultPage.tsx` (Vista de resultados y retroalimentación)
- `frontend/src/pages/TeacherGradingPage.tsx` (Panel docente para revisión de respuestas abiertas)

---

## 18. Cambios de Base de Datos

| Necesidad | Clasificación | Análisis |
| :--- | :--- | :--- |
| **Modelos `Assessment`, `Question`, `Attempt`, etc.** | 🟢 Ya soportada | Todas las tablas ya están creadas físicamente en la base de datos PostgreSQL. |
| **Enum `AssessmentType` y `QuestionType`** | 🟢 Ya soportada | Enums oficiales listos en el schema. |
| **Nuevas columnas para MVP V1 (`dueDate`, `isLate`)** | 🟢 No requiere cambios | `dueDate` y `isLate` se derivan de `availableUntil` y `submittedAt`. Cero cambios en el schema. |

---

## 19. API HTTP Propuesta (Para Fase 8.2 - 8.5)

```text
GET    /api/courses/:courseId/assessments          → Listar evaluaciones del curso
POST   /api/courses/:courseId/assessments          → Crear evaluación (Docente/Admin)
GET    /api/assessments/:assessmentId               → Consultar detalle de evaluación
PUT    /api/assessments/:assessmentId               → Actualizar evaluación

POST   /api/assessments/:assessmentId/questions     → Agregar reactivo a evaluación
PUT    /api/questions/:questionId                   → Actualizar reactivo / opciones

POST   /api/assessments/:assessmentId/attempts      → Iniciar / Restaurar intento (Alumno)
GET    /api/attempts/:attemptId                     → Consultar estado del intento
POST   /api/attempts/:attemptId/answers             → Guardar respuesta incremental
POST   /api/attempts/:attemptId/submit              → Entregar evaluación (Finalizar intento)

GET    /api/assessments/:assessmentId/results       → Consultar resultados del grupo (Docente)
POST   /api/answers/:answerId/grade                 → Calificación manual de respuesta abierta (Docente)
```

---

## 20. Analytics Futuro y Métricas Académicas

El modelo satisface los requerimientos para calcular posteriormente sin cambios de schema:
- **Hake Gain** ($g$):
  $$g = \frac{\text{PostTestScore} - \text{PreTestScore}}{100 - \text{PreTestScore}}$$
  Utiliza los tipos `DIAGNOSTIC` (Pre-test) y `FINAL` (Post-test) por alumno.
- **`submittedAt` como Fuente de Verdad**: Permite derivar en el futuro tasa de entregas tardías, promedios, medianas y desempeño por reactivo.

---

## 21. Matriz de Decisiones de Dominio

| Tema | Estado Actual | Propuesta V1 | Cambio DB | Estado de Decisión |
| :--- | :--- | :--- | :--- | :--- |
| **Modelos de Evaluaciones** | Creados en PostgreSQL | Reutilizar tablas `assessments`, `questions`, etc. | No | `APROBADO PREVIAMENTE` |
| **Ponderación (`weight`)** | `@db.Decimal(5,2)` en `Assessment` | Escala 0-100% por curso | No | `APROBADO PREVIAMENTE` |
| **Intentos Múltiples** | `maxAttempts` en `Assessment` | `null` = ilimitados, entero $\ge 1$ = límite | No | `APROBADO PREVIAMENTE` |
| **Evaluación Automática** | No implementada | Autocalificar `MULTIPLE_CHOICE`, `MULTIPLE_SELECT`, `TRUE_FALSE`, `NUMERIC` | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Revisión Manual** | No implementada | Docente califica `OPEN_TEXT` en `Answer.pointsEarned` | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Integridad Histórica** | No implementada | Opción A: Bloquear edición destructiva tras 1er intento | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Versión de Preguntas (`QuestionVersion`)** | No existe | Diferido para versiones futuras (YAGNI) | No | `YAGNI / DEFERRED` |
| **Visualización de Respuestas Correctas** | No existe | Solo tras finalizar el intento o cerrar la fecha | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Available From** | En `Assessment` | Inicio de ventana de nuevos intentos | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Available Until** | En `Assessment` | Cierre de ventana para iniciar nuevos intentos | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Due Date** | No existe en BD | Diferido / Derivado de `availableUntil` | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Late Submission** | No existe en BD | Permita entrega; `isLate = submittedAt > availableUntil` derivado | No | `APROBADO PARA IMPLEMENTACIÓN` |
| **Time Limit** | En `Assessment` | Valida cronómetro `startedAt + timeLimitMinutes` | No | `APROBADO PARA IMPLEMENTACIÓN` |

---

## 22. Matriz de Riesgos

| Riesgo | Nivel | Mitigación Técnica Propuesta |
| :--- | :---: | :--- |
| **Inyección/Envío de Score por el Alumno** | 🔴 Alto | El score se calcula **estrictamente en backend** en la transacción de entrega (`submit`). |
| **Exposición de Respuestas Correctas vía JSON** | 🔴 Alto | Los DTOs para `STUDENT` **omiten** el campo `isCorrect` de `QuestionOption`. |
| **Doble Envío / Condición de Carrera en `submit`** | 🔴 Alto | Se utiliza transacción atómica Prisma en `submit` validando `status === IN_PROGRESS`. |
| **Acceso No Autorizado a Intentos (IDOR)** | 🔴 Alto | Se valida `Attempt.studentId === req.user.id` en todos los endpoints del alumno. |
| **Alteración de Exámenes con Intentos Existentes** | 🟠 Medio | Se implementa validación de bloqueo en `AssessmentService` si existen intentos `SUBMITTED`. |
| **Vulnerabilidad XSS en Markdown/KaTeX** | 🟠 Medio | Sanitización obligatoria con `isomorphic-dompurify` antes de renderizar reactivos. |

---

## 23. Orden Recomendado de Implementación Futura (Fases 8.1 - 8.10)

```text
Fase 8.0 — Levantamiento Técnico y Diseño (COMPLETADA - STOP)
  ↓
Fase 8.1 — Decisiones Funcionales & Semántica Definitiva de Fechas (COMPLETADA - STOP)
  ↓
Fase 8.2 — Backend Assessment & Question Management (Service & Controllers para Docente)
  ↓
Fase 8.3 — Backend Attempt & Player Engine (Creación de intentos, guardado y submit atómico)
  ↓
Fase 8.4 — Backend Auto-Grading & Manual Grading Service
  ↓
Fase 8.5 — Frontend Teacher Assessment Editor (Creación de exámenes y banco de preguntas)
  ↓
Fase 8.6 — Frontend Student Assessment Player (Interfaz de realización de exámenes)
  ↓
Fase 8.7 — Frontend Results & Grading Panel (Revisión docente de preguntas abiertas)
  ↓
Fase 8.8 — Integration Testing & Security Audit
```

---

## 24. Checklist de Cierre — Fase 8.0 & 8.1 (Complementada)

### Fechas y Entregas
- 🟢 `availableFrom` definido (inicio de ventana de nuevos intentos)
- 🟢 `availableUntil` definido (cierre de ventana de nuevos intentos)
- 🟢 `timeLimitMinutes` definido (duración máxima del intento desde `startedAt`)
- 🟢 `dueDate` diferido/no requerido en V1 (`availableUntil` actúa como referencia)
- 🟢 entregas tardías permitidas
- 🟢 `isLate` derivado dinámicamente (`submittedAt > availableUntil`)
- 🟢 `IN_PROGRESS` no cancelado por `availableUntil`
- 🟢 `timeLimitMinutes` independiente de `availableUntil`
- 🟢 auto-submit asociado a expiración de `timeLimitMinutes`

---

## 25. Functional Decisions V1 (Fase 8.1)

### 25.1. Reglas de Puntuación y Calificación
1. **Modelo de Puntos por Reactivo**: `AssessmentQuestion.points` establece el valor de cada pregunta dentro de una evaluación específica. El puntaje máximo posible de la evaluación es derivado dinámicamente como $\text{TotalMaxPoints} = \sum \text{AssessmentQuestion.points}$. No requiere persistir un campo `totalPoints`.
2. **Cálculo de Score**: $\text{score} = (\text{TotalPointsEarned} / \text{TotalMaxPoints}) \times 100$. Representa el porcentaje en escala 0.00 a 100.00 y se almacena en `Attempt.score`. Es calculado **estrictamente en el backend**.
3. **Ponderación del Curso (`Assessment.weight`)**: Representa la contribución porcentual (0-100%) de la evaluación en la calificación final del curso. Un curso en `DRAFT` puede tener una suma de pesos incompleta; al transicionar a `ACTIVE`, el backend advertirá o validará la configuración.
4. **Calificación Mínima Aprobatoria (`Assessment.passingScore`)**: Porcentaje mínimo necesario para considerar aprobada una evaluación (ej. 70.00%). Si es `null`, no se aplica criterio de aprobación estricto.

### 25.2. Política de Intentos Múltiples
1. **Semántica de `maxAttempts`**: `null` = intentos ilimitados. Entero $\ge 1$ = límite máximo de intentos por alumno.
2. **Numeración**: Cada intento se registra secuencialmente en `Attempt.attemptNumber` (1, 2, 3...).
3. **Intento Único `IN_PROGRESS`**: Se garantiza mediante backend y restricción única que un alumno no puede tener más de un intento activo (`status = IN_PROGRESS`) simultáneamente para el mismo `Assessment`.
4. **Intento que Cuenta para la Calificación Final**: **Mejor Intento** ($\max(\text{score})$) entre los intentos finalizados (`status = GRADED`). Favorece el aprendizaje y la nivelación académica.

### 25.3. Comportamiento por Tipo de Pregunta y Calificación
1. **`MULTIPLE_CHOICE`**: Exactamente 1 opción correcta (`isCorrect = true`). Alumno selecciona 1. Autocalificada en backend.
2. **`MULTIPLE_SELECT`**: 1 o más opciones correctas. Alumno selecciona N opciones. Autocalificada en backend exigiendo coincidencia exacta del conjunto de opciones correctas (100% de los puntos si coincide exactamente, 0% en caso contrario).
3. **`TRUE_FALSE`**: Caso especial con 2 opciones ("Verdadero"/"Falso"). Autocalificada en backend.
4. **`NUMERIC`**: Alumno ingresa valor numérico en `numericValue`. Evaluado en backend con tolerancia estricta ($|\text{val} - \text{target}| \le 0.0001$). Autocalificado.
5. **`OPEN_TEXT`**: Alumno escribe respuesta textual en `textValue`. Requiere revisión manual por parte del docente (`TEACHER`/`ADMIN`), quien asigna `pointsEarned` y `feedback`.

### 25.4. Semántica de Estados del Intento (`AttemptStatus`)
- **`IN_PROGRESS`**: Intento iniciado por el alumno, respuestas guardadas de forma incremental, no entregado aún.
- **`SUBMITTED`**: Intento entregado por el alumno. Si contiene preguntas `OPEN_TEXT`, permanece en este estado pendiente de calificación manual docente.
- **`GRADED`**: Todas las preguntas del intento han sido calificadas (automática o manualmente) y el `score` final está consolidado.

### 25.5. Fechas, Disponibilidad y Entregas Tardías (Semántica Inequívoca)
1. **`availableFrom`**: Instante a partir del cual el alumno puede iniciar intentos (`now >= availableFrom`).
2. **`availableUntil`**: Cierre de la ventana para **iniciar nuevos intentos** (`now <= availableUntil`). Rechaza la creación de nuevos `Attempt` si `now > availableUntil`.
   - **Regla Inequívoca**: Al llegar `availableUntil`, un intento que ya se encontraba `IN_PROGRESS` **NO se cancela automáticamente**. El alumno puede continuar su intento según las reglas de `timeLimitMinutes`.
3. **`timeLimitMinutes`**: Duración máxima del intento desde `startedAt`. El backend valida el cronómetro con tolerancia de red (+1 min). Si expira, auto-entrega las respuestas guardadas hasta ese momento.
4. **Entregas Tardías (`isLate`)**: Permitidas en V1. Se derivan dinámicamente como `isLate = submittedAt > availableUntil`. Cero campos adicionales en PostgreSQL (`dueDate` NO, `isLate` NO).

---

> ✋ **PARADA DE SEGURIDAD ABSOLUTA (COMPLEMENTO FASE 8.1 COMPLETADO)**: La semántica de fechas, tiempo límite y entregas tardías del Assessment Engine V1 ha sido cerrada e independizada de ambigüedades en este documento. No se ha implementado código ejecutable ni se modificó la base de datos. Esperando revisión y aprobación explícita antes de proceder a la Fase 8.2.

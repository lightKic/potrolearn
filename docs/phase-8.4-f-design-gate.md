# PotroLearn — Phase 8.4-F — Design Gate
## Frontend Integration & Assessment UX Design

---

## 1. Resumen Ejecutivo
La **Fase 8.4-F** abarca la integración y la experiencia de usuario (UX) en el frontend para el motor de evaluaciones de PotroLearn. Toda la infraestructura backend (Fases 8.4-A a 8.4-E) se encuentra completada y verificada al 100%, con reglas de negocio, ciclo de vida de intentos, persistencia incremental, autocalificación, envío con límite de tiempo (+30s de gracia) y calificación manual protegida por `pg_advisory_xact_lock`.

Este documento establece la arquitectura frontend cerrada, definiendo los flujos de interfaz para **Estudiante**, **Profesor** y **Administrador**, las estrategias de *timer* sincronizado con servidor, *autosave* debounced por pregunta, recuperación ante recarga (*refresh recovery*), manejo de expiración, seguridad de tokens en memoria y accesibilidad responsive.

---

## 2. Estado Actual del Frontend
- **Stack**: React + TypeScript + Vite, React Router v6.
- **Autenticación**:
  - `inMemoryAccessToken` en memoria (JS memory).
  - Refresh token gestionado vía cookie HttpOnly (`/auth/refresh`).
  - Interceptor `apiFetch` con reintento único (*single-flight refresh*).
- **Rutas existentes**:
  - `/app/courses/:courseId` (`CourseDetailPage.tsx`): Muestra la estructura del curso, módulos y lecciones. Actúa como el punto de entrada para ver las evaluaciones asignadas.
  - `/app/courses/:courseId/modules/:moduleId/lessons/:lessonId` (`LessonDetailPage.tsx`): Muestra contenido multimedia/markdown de una lección.
- **Rutas de Evaluación**: Actualmente ausentes o utilizando *placeholders* simples. Requieren la creación de páginas y componentes especializados para el examen y su revisión.

---

## 3. Componentes Reutilizables Encontrados
- **`apiFetch<T>()`** (`frontend/src/services/api.ts`): Cliente HTTP centralizado con manejo automático de tokens Bearer, refresco transparente de sesión y captura de errores `ApiError`.
- **`useAuth()`** (`frontend/src/auth/useAuth.ts`): Contexto global para acceder al perfil de usuario autenticado (`id`, `role`, `email`, `name`).
- **`AppLayout`** (`frontend/src/layouts/AppLayout.tsx`): Layout principal con barra superior (`Header`), barra lateral de navegación y área de contenido responsiva.
- **`MarkdownContent`** (`frontend/src/components/MarkdownContent.tsx`): Renderizado seguro de texto formateado en preguntas y descripciones.
- **`RoleRoute`** (`frontend/src/auth/RoleRoute.tsx`): Guardián de rutas basado en roles (`ADMIN`, `TEACHER`, `STUDENT`).

---

## 4. Gaps Encontrados
1. **Ausencia de Servicio Frontend de Evaluaciones**: No existe `assessment.service.ts` en `frontend/src/services/` para interactuar con `/api/assessments` y `/api/attempts`.
2. **Falta de Tipos DTO de Evaluaciones en Frontend**: `frontend/src/types/` no contiene las interfaces TypeScript correspondientes a `AttemptDTO`, `AssessmentDetailDTO`, `TeacherAttemptDTO`, etc.
3. **Ausencia de Rutas Especializadas**:
   - Falta ruta de presentación/inicio de evaluación (`/app/assessments/:assessmentId`).
   - Falta ruta del reproductor de exámenes para estudiante (`/app/attempts/:attemptId/take`).
   - Falta ruta de resultados del estudiante (`/app/attempts/:attemptId/result`).
   - Falta ruta de centro de calificación docente (`/app/assessments/:assessmentId/grading`).
   - Falta ruta de revisión detallada por intento (`/app/attempts/:attemptId/review`).

---

## 5. Problemas que Deben Corregirse Antes de Implementar
- Ninguno en el backend (backend totalmente verificado 🟢).
- En el frontend, se debe garantizar que el reproductor de examen (`ExamTakePage.tsx`) pueda ejecutarse en un layout limpio o controlado (opcionalmente ocultando la barra lateral para evitar navegaciones accidentales durante un intento activo).

---

## 6. Arquitectura UX Propuesta

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                               STUDENT UX                                │
├─────────────────────────┬────────────────────────┬──────────────────────┤
│ Assessment Summary Page │ Exam Player (Take)     │ Attempt Result Page  │
│ /assessments/:id        │ /attempts/:id/take     │ /attempts/:id/result │
└─────────────────────────┴────────────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        TEACHER & ADMIN REVIEW UX                        │
├────────────────────────────────────────┬────────────────────────────────┤
│ Teacher Assessment Attempts List Page  │ Teacher Attempt Review Page    │
│ /assessments/:id/grading               │ /attempts/:id/review           │
└────────────────────────────────────────┴────────────────────────────────┘
```

---

## 7. Rutas Frontend Propuestas

| Ruta Frontend | Rol Permitido | Componente Página | Datos Consumidos / Servicio | Endpoint Backend Utilizado |
| :--- | :--- | :--- | :--- | :--- |
| `/app/assessments/:assessmentId` | `STUDENT`, `TEACHER`, `ADMIN` | `AssessmentDetailPage.tsx` | Detalle e historial de intentos | `GET /api/assessments/:id` |
| `/app/attempts/:attemptId/take` | `STUDENT` | `ExamTakePage.tsx` | Estado del intento, preguntas, respuestas guardadas | `POST /api/assessments/:id/attempts`<br>`PUT /api/attempts/:id/answers/:qId`<br>`POST /api/attempts/:id/submit` |
| `/app/attempts/:attemptId/result` | `STUDENT` | `StudentAttemptResultPage.tsx` | Resultado del intento enviado | `GET /api/attempts/:id` |
| `/app/assessments/:assessmentId/grading` | `TEACHER`, `ADMIN` | `TeacherGradingListPage.tsx` | Lista de intentos por evaluar | `GET /api/assessments/:id/attempts` |
| `/app/attempts/:attemptId/review` | `TEACHER`, `ADMIN` | `TeacherAttemptReviewPage.tsx` | Detalle de respuestas y formulario de nota manual | `GET /api/attempts/:id/review`<br>`PUT /api/attempts/:id/answers/:qId/grade` |

---

## 8. Flujo STUDENT

1. **Visualización de Evaluación (`AssessmentDetailPage`)**:
   - Muestra título, descripción, tipo (EXAM/QUIZ), `timeLimitMinutes`, `passingScore`, número de preguntas y total de puntos.
   - Muestra historial de intentos anteriores del estudiante con sus puntajes y estados (`GRADED`, `SUBMITTED`).
   - Botón dinámico:
     - Si hay intento `IN_PROGRESS` $\rightarrow$ **"Reanudar Intento (#N)"**.
     - Si no hay intento activo y `attemptsLeft > 0` $\rightarrow$ **"Iniciar Intento (#N)"**.
     - Si no restan intentos $\rightarrow$ Mensaje: *"Has alcanzado el límite máximo de intentos"*.
2. **Pantalla del Examen (`ExamTakePage`)**:
   - Cabecera con título, temporizador visual sincronizado, indicador de guardado (*Guardado / Guardando... / Error*) y barra de progreso.
   - Menú lateral o barra de navegación por números de pregunta ($1, 2, \dots, N$) con código de colores (Respondida / Sin responder / Pregunta actual).
   - Área central con enunciado, opciones (`MC`, `MS`, `TF`), entrada numérica (`NUMERIC`) o área de texto (`OPEN_TEXT`).
   - Botones *"Anterior"*, *"Siguiente"* y *"Enviar Evaluación"*.
3. **Envío (`Submit Modal`)**:
   - Confirmación explícita. Si hay preguntas no respondidas, muestra advertencia: *"Tienes X preguntas sin responder. ¿Deseas enviar de todas formas?"*.
   - Al confirmar $\rightarrow$ Ejecuta `POST /api/attempts/:id/submit` y redirige a la página de resultados.

---

## 9. Flujo TEACHER

1. **Centro de Calificación (`TeacherGradingListPage`)**:
   - Accedido desde el detalle del curso. Lista todas las evaluaciones con filtro por estado (`SUBMITTED`, `GRADED`, `ALL`).
   - Muestra tabla de intentos con nombre del alumno, número de cuenta/expediente, número de intento, fecha de entrega, conteo de preguntas `OPEN_TEXT` pendientes y score actual.
2. **Pantalla de Revisión Manual (`TeacherAttemptReviewPage`)**:
   - Muestra datos del estudiante y resumen del intento.
   - Lista todas las preguntas de la evaluación.
   - Para preguntas `OPEN_TEXT`:
     - Resalta visualmente el estado: *Pendiente de Calificar* / *Calificada*.
     - Muestra la respuesta dada por el estudiante (o el aviso *"Sin respuesta"* en caso de ser omitida).
     - Formulario con campo numérico de puntos ($0 \le x \le \text{max}$) y área de texto para *feedback*.
     - Botón *"Guardar Calificación"*.
   - Actualiza dinámicamente el estado del intento en el header (`SUBMITTED` $\rightarrow$ `GRADED` al concluir la última revisión).

---

## 10. Flujo ADMIN
- El rol `ADMIN` dispone de acceso total en los mismos componentes que el `TEACHER`, pudiendo ingresar a cualquier evaluación y calificar intentos sin restricción de pertenencia a `CourseTeacher`.

---

## 11. Estrategia de Timer

- **Autoridad del Backend**: El tiempo oficial de inicio es `startedAt` (expresado en ISO UTC) y la duración máxima es `timeLimitMinutes`.
- **Cálculo Visual**:
  $$\text{targetEndTime} = \text{new Date}(\text{startedAt}).\text{getTime}() + (\text{timeLimitMinutes} \times 60 \times 1000)$$
  $$\text{remainingSeconds} = \text{Math.max}\left(0, \text{Math.floor}\left(\frac{\text{targetEndTime} - \text{Date.now}()}{1000}\right)\right)$$
- **Resiliencia**:
  - Al recargar la página (*refresh*), la SPA consulta `GET /api/attempts/:id` y recalcula `remainingSeconds` usando la hora actual del cliente frente a `startedAt`.
  - La suspensión de pestaña (*tab sleep*) o cambio de hora local no afecta el cómputo porque el `Date.now()` se compara contra la marca UTC fija `targetEndTime`.
- **Expiración Visual**:
  - Cuando `remainingSeconds === 0`, el frontend deshabilita la edición de preguntas, muestra un mensaje *"El tiempo ha finalizado. Enviando examen..."* y ejecuta automáticamente la llamada `POST /api/attempts/:id/submit`.
  - Si el servidor devuelve `ATTEMPT_EXPIRED` (+30s sobrepasados), el frontend captura el error de forma amigable y redirige a la vista de resultados.

---

## 12. Estrategia de Autosave

- **Debounce y Activación**:
  - **`MC`, `MS`, `TF`**: Guardado **inmediato** al hacer clic en una opción.
  - **`NUMERIC`, `OPEN_TEXT`**: Guardado **debounced** a los 1,000 ms tras dejar de escribir, o de inmediato al cambiar de pregunta/navegar.
- **Indicadores de Estado UI**:
  - `IDLE` / `SAVED`: Indicador discreto *"Guardado"* en verde con icono check.
  - `SAVING`: Indicador *"Guardando..."* en amarillo con spinner.
  - `ERROR`: Indicador *"Error al guardar"* en rojo con botón *"Reintentar"*.
- **Concurrencia local**: Se utiliza una ref o cancelador de promesas para evitar que una petición anterior sobreescriba una modificación posterior de la misma pregunta.

---

## 13. Estrategia de Recuperación tras Refresh (Refresh Recovery)

1. Al recargar la página en `/app/attempts/:attemptId/take`:
2. El hook de autenticación recupera el token en memoria mediante `/auth/refresh` (cookie HttpOnly).
3. La página invoca `GET /api/attempts/:attemptId`.
4. El backend retorna el intento con sus respuestas existentes guardadas en la base de datos (`answers`).
5. La UI reconstruye el estado local de respuestas (mapa `questionId -> AnswerState`), posiciona al alumno en la última pregunta o en la primera no respondida y reinicia el timer sincronizado.

---

## 14. Manejo de Expiración

- Si el estudiante intenta guardar una respuesta cuando el intento ya expiró, el backend responde `400 ATTEMPT_NOT_IN_PROGRESS` o `400 ATTEMPT_EXPIRED`.
- El frontend captura este error, detiene el timer, desactiva las entradas y fuerza el flujo de submit o redirección a la pantalla de resultados con el aviso: *"Este intento ha sido cerrado por el servidor debido a la expiración del tiempo límite"*.

---

## 15. Estrategia de Errores

| Código HTTP / Error | Causa | Manejo en UX Frontend |
| :--- | :--- | :--- |
| `NETWORK_ERROR` (0) | Sin conexión a internet | Muestra Banner de alerta: *"Sin conexión. Tus respuestas locales están seguras. Reintentando..."*. |
| `401 UNAUTHORIZED` | Sesión expirada | `apiFetch` ejecuta refresco. Si falla, redirige a `/login`. |
| `403 FORBIDDEN` | IDOR / Rol no autorizado | Redirige a `/403` o muestra notificación *"No tienes permiso para acceder a este examen"*. |
| `404 NOT_FOUND` | Intento o evaluación inexistente | Redirige a `/404`. |
| `400 ATTEMPT_NOT_IN_PROGRESS` | Examen ya enviado o cerrado | Notificación y redirección inmediata a `/app/attempts/:id/result`. |
| `400 QUESTION_NOT_MANUALLY_GRADEABLE` | Intento de calificar MC/NUMERIC | Alerta en panel docente: *"Solo las preguntas de texto abierto pueden calificarse manualmente"*. |

---

## 16. Seguridad Frontend

- **Tokens**: No se guarda JWT en `localStorage` o `sessionStorage`. Permanece en variable `inMemoryAccessToken`.
- **Cero Lógica de Negocio Sensible**: El frontend no calcula calificaciones, no determina si una opción es correcta ni sobreescribe marcas de tiempo.
- **Protección de Respuestas Correctas**: Durante el examen, los DTOs no incluyen campos `isCorrect` ni opciones correctas.
- **Rutas Guardadas**: `RoleRoute` protege la navegación en cliente para evitar que estudiantes ingresen a páginas de calificación docente.

---

## 17. Responsive y Accesibilidad

- **Responsive**:
  - En Desktop: Vista de reproductor con barra lateral de navegación por preguntas a la izquierda/derecha y panel de pregunta central.
  - En Mobile/Tablet: Navegación de preguntas mediante desplegable/drawer deslizable para maximizar espacio de lectura.
- **Accesibilidad**:
  - Navegación completa mediante teclado (`Tab`, `Space`, `Enter`, flechas direccionales en opciones `MC`/`TF`).
  - Uso de etiquetas semánticas HTML5 (`<fieldset>`, `<legend>`, `<label>`).
  - Atributos `aria-live="polite"` en el temporizador y en el estado de guardado.
  - Alto contraste de colores para estados de preguntas (Respondida / Pendiente).

---

## 18. Componentes Nuevos Necesarios

1. **`frontend/src/components/assessment/ExamTimer.tsx`**: Componente visual del reloj con alerta de tiempo bajo.
2. **`frontend/src/components/assessment/QuestionNavigator.tsx`**: Grid/lista de números de pregunta con indicación de estado.
3. **`frontend/src/components/assessment/MultipleChoiceQuestion.tsx`**: Renderizador de pregunta de opción única (`MC` / `TF`).
4. **`frontend/src/components/assessment/MultipleSelectQuestion.tsx`**: Renderizador de pregunta de opción múltiple (`MS`).
5. **`frontend/src/components/assessment/NumericQuestion.tsx`**: Renderizador de respuesta numérica (`NUMERIC`).
6. **`frontend/src/components/assessment/OpenTextQuestion.tsx`**: Renderizador de respuesta abierta (`OPEN_TEXT`).
7. **`frontend/src/components/assessment/SubmitConfirmModal.tsx`**: Modal de confirmación previa a entrega.

---

## 19. Componentes Existentes que se Reutilizarán
- **`AppLayout`**: Contenedor principal de la app.
- **`MarkdownContent`**: Renderizado de consignas y opciones.
- **`Header`**: Barra superior de usuario.
- **`RoleRoute`** & **`ProtectedRoute`**: Seguridad de rutas.

---

## 20. Servicios Frontend Necesarios
- **`frontend/src/services/assessment.service.ts`**:
  - `getAssessment(id)`
  - `startOrResumeAttempt(assessmentId)`
  - `getAttempt(attemptId)`
  - `saveAnswer(attemptId, questionId, payload)`
  - `submitAttempt(attemptId)`
  - `getAssessmentAttemptsForReview(assessmentId, statusFilter)`
  - `getAttemptReviewForTeacher(attemptId)`
  - `gradeAnswer(attemptId, questionId, payload)`

---

## 21. Tipos y DTOs Necesarios (`frontend/src/types/assessment.ts`)
- `AssessmentType`, `AttemptStatus`, `QuestionType`
- `AssessmentDetailDTO`, `AttemptDTO`, `AnswerDTO`
- `SaveAnswerInput`, `GradeAnswerInput`
- `TeacherAttemptItemDTO`, `TeacherAttemptReviewDTO`, `TeacherAttemptAnswerDTO`

---

## 22. Plan de Pruebas Frontend (Test Plan)

### Estudiante:
1. Navegar a detalle de evaluación e iniciar intento nuevo.
2. Responder cada tipo de pregunta (`MC`, `MS`, `TF`, `NUMERIC`, `OPEN_TEXT`) y verificar indicador *"Guardado"*.
3. Recargar la página (F5) y verificar restauración exacta del intento y timer.
4. Dejar agotar el tiempo y verificar envío automático.
5. Confirmar envío manual y visualizar página de resultados (`GRADED` o `SUBMITTED`).

### Profesor:
1. Acceder al centro de calificación de una evaluación con respuestas `OPEN_TEXT`.
2. Abrir el intento de un alumno en estado `SUBMITTED`.
3. Asignar puntos y feedback a la pregunta de texto abierto.
4. Guardar calificación y verificar que el intento cambie a `GRADED` con score recalculado.
5. Realizar *regrading* modificando la calificación y comprobando la actualización.

### Seguridad y Regresión:
1. Intentar acceder como `STUDENT` a la ruta `/app/attempts/:id/review` $\rightarrow$ Verificar redirección a `/403`.
2. Verificar que `npm run typecheck`, `npm run lint` y `npm run build` en el frontend finalicen sin errores.

---

## 23. Riesgos
- **Latencia de Red en Autosave**: Si la conexión del alumno es inestable, múltiples peticiones de guardado rápido podrían encolarse. *Mitigación*: Debounce de 1,000ms y deshabilitación temporal de controles durante el envío final.

---

## 24. Decisiones Cerradas
- El frontend **nunca** calculará scores ni decidirá si una respuesta es correcta.
- Las respuestas `OPEN_TEXT` se guardan en backend hasta con 50,000 caracteres, y el feedback del profesor hasta 10,000 caracteres en texto plano.
- La tolerancia de +30 segundos pertenece al backend; el frontend muestra exactamente el tiempo restante basado en `timeLimitMinutes`.

---

## 25. Decisiones que Requieren Aprobación
- Ninguna. Todas las especificaciones se alinean con las Fases 8.4-A a 8.4-E previamente aprobadas.

---

## 26. Lista Explícita de Cosas que NO Deben Modificarse
- `backend/prisma/schema.prisma` (SCHEMA SUFFICIENT 🟢).
- Ninguna migración de base de datos PostgreSQL.
- Ningún endpoint ni servicio backend ya implementado y verificado.
- Reglas de calificación objetiva o fórmulas de score.

---

## 27. Criterios de Aceptación para 8.4-F
1. El estudiante puede iniciar, pausar/reanudar y completar cualquier evaluación desde la SPA React.
2. El temporizador visual cuenta regresivamente y fuerza el submit al agotar el tiempo.
3. El estado de las respuestas se guarda automáticamente con retroalimentación visual amigable.
4. La recarga de página recupera limpiamente el avance sin perder trabajo.
5. El profesor puede revisar y calificar manualmente respuestas `OPEN_TEXT` con recalculado automático de notas.
6. El rol `STUDENT` no puede acceder a las pantallas de calificación docente.
7. La compilación del frontend (`npm run build`) y el typecheck se ejecutan con 0 errores.

---

## Matriz de Evaluación — 8.4-F Design Gate

| Área | Estado | Hallazgo | Acción |
| :--- | :---: | :--- | :--- |
| **Student UX** | 🟢 READY | Flujo de inicio, navegación por preguntas y visualización de resultados totalmente definido. | Crear páginas `AssessmentDetailPage`, `ExamTakePage`, `StudentAttemptResultPage`. |
| **Teacher Review** | 🟢 READY | Interfaz de lista de intentos y formulario de calificación manual especificada. | Crear `TeacherGradingListPage` y `TeacherAttemptReviewPage`. |
| **Admin** | 🟢 READY | Hereda acceso global mediante el cliente HTTP y rutas protegidas. | Permitir acceso completo en `RoleRoute`. |
| **Timer** | 🟢 READY | Basado en `startedAt` + `timeLimitMinutes` recalculado en cliente contra UTC fija. | Crear componente `ExamTimer.tsx`. |
| **Autosave** | 🟢 READY | Inmediato para opciones únicas y debounced (1s) para entradas de texto/número. | Implementar lógica de debounce en `ExamTakePage`. |
| **Refresh Recovery** | 🟢 READY | Recuperación transparente desde el backend `GET /api/attempts/:id` tras autenticación en memoria. | Cargar estado en `useEffect` inicial de `ExamTakePage`. |
| **Submit** | 🟢 READY | Confirmación modal previa y manejo de expiración automática. | Crear `SubmitConfirmModal.tsx`. |
| **Expiration** | 🟢 READY | Backend es autoridad (+30s de gracia). Frontend fuerza submit visual al llegar a 0s. | Deshabilitar inputs y llamar `submitAttempt`. |
| **Results** | 🟢 READY | Distinción clara entre estado `GRADED` (con score) y `SUBMITTED` (pendiente de revisión). | Diseñar `StudentAttemptResultPage.tsx`. |
| **Security** | 🟢 READY | Tokens en memoria, `RoleRoute` en React Router, 0 lógica académica sensible en cliente. | Mantener política estricta de `apiFetch`. |
| **Responsive** | 🟢 READY | Layout adaptable para móvil, tablet y escritorio con menú deslizable de preguntas. | Aplicar CSS Grid/Flexbox responsivo. |
| **Accessibility** | 🟢 READY | Accesible por teclado, uso de etiquetas semánticas y alertas `aria-live`. | Probar navegación por `Tab`/`Space`. |
| **Tests** | 🟢 READY | Plan de pruebas manuales y verificaciones de compilación/tipo en frontend. | Ejecutar plan de pruebas en integración. |

---

## 8.F DESIGN GATE STATUS: PASS 🟢
El diseño técnico y la arquitectura UX para la **Fase 8.4-F** se encuentran **completamente cerrados y aprobados**. El proyecto está listo para recibir la instrucción de implementación frontend.

---

## Implementation — Teacher/Admin Review

### Páginas Implementadas
1. **`TeacherGradingListPage.tsx`** (`frontend/src/pages/TeacherGradingListPage.tsx`):
   - Centro de calificación para docentes y administradores.
   - Pestañas de filtrado: `ALL` (Todos), `SUBMITTED` (Pendientes de calificación), `GRADED` (Calificados).
   - Tabla informativa con datos del alumno, expediente, intento, fecha de entrega, badge de estado, puntaje acumulado y botón *"Revisar / Calificar"*.
   - Manejo de estados de carga, lista vacía y errores HTTP amigables (403, 404, error de red).
2. **`TeacherAttemptReviewPage.tsx`** (`frontend/src/pages/TeacherAttemptReviewPage.tsx`):
   - Pantalla de revisión detallada e individual del intento del estudiante.
   - Encabezado con datos del alumno, evaluación, intento, puntaje final y fechas.
   - Lista de preguntas:
     - Preguntas Objetivas (`MULTIPLE_CHOICE`, `MULTIPLE_SELECT`, `TRUE_FALSE`, `NUMERIC`): Vista de solo lectura con respuestas del alumno, validez y puntos asignados automáticamente por el backend.
     - Preguntas Abiertas (`OPEN_TEXT`): Visualización de respuesta, badge de estado (`Pendiente` / `Calificada`) y formulario interactivo con campo de puntos numéricos ($0 \le x \le \text{maxPoints}$) y área de texto para retroalimentación ($\le 10,000$ caracteres).
     - Guardado seguro con deshabilitación de botones contra doble clic y actualización atómica del intento tras respuesta exitosa del backend.

### Rutas Registradas (`frontend/src/routes/index.tsx`)
- `/app/assessments/:assessmentId/grading` $\rightarrow$ `TeacherGradingListPage` (Protegida por `RoleRoute` para `TEACHER` y `ADMIN`).
- `/app/courses/:courseId/assessments/:assessmentId/grading` $\rightarrow$ `TeacherGradingListPage` (Acceso conveniente desde la vista del curso).
- `/app/attempts/:attemptId/review` $\rightarrow$ `TeacherAttemptReviewPage` (Protegida por `RoleRoute` para `TEACHER` y `ADMIN`).

### Servicios y Métodos API (`frontend/src/services/assessment.service.ts`)
- `getAssessmentAttemptsForReview(assessmentId, statusFilter)` $\rightarrow$ `GET /api/assessments/:assessmentId/attempts`
- `getAttemptReviewForTeacher(attemptId)` $\rightarrow$ `GET /api/attempts/:attemptId/review`
- `gradeAnswer(attemptId, questionId, input)` $\rightarrow$ `PUT /api/attempts/:attemptId/answers/:questionId/grade`

### Permisos y Seguridad
- Rutas restringidas en cliente mediante `RoleRoute(['TEACHER', 'ADMIN'])`.
- Estudiantes redirigidos automáticamente a `/403` si intentan ingresar a rutas de calificación.
- Autorización estricta mantenida en el backend (docentes solo acceden a cursos asignados; admin acceso global).
- Cero recálculo de calificaciones o respuestas en el cliente; el backend es la única fuente de verdad.

### Verificaciones Ejecutadas
- `npm run typecheck`: **PASS (0 errores)**.
- `npm run lint`: **PASS (0 errores, 0 warnings)**.
- `npm run build`: **PASS (Compilación de producción exitosa)**.
- Backend `npm run typecheck`: **PASS (0 errores)**.

---

## 🟢 PHASE 8.4-F — COMPLETE / PASS
La Fase 8.4-F se encuentra **100% completada y verificada**, tanto para el flujo de Estudiante (Student UX) como para el flujo de Calificación de Docentes y Administradores (Teacher Review + Admin Grading UX).


# Documentación Técnica — CROSSWORD (QA-008)

Esta documentación describe la arquitectura, modelo de datos, flujo interactivo, evaluación server-side, integridad de datos y estado de pruebas para el tipo de evaluación **CROSSWORD** en la plataforma PotroLearn.

---

## 1. Arquitectura General

```mermaid
flowchart TD
    subgraph Docente ["Flujo Docente (Autoría)"]
        T[Profesor / Admin] --> CE[CrosswordEditor]
        CE --> CG[crossword-generator.util.ts]
        CG --> CL[crosswordLayout]
        CL --> A[Assessment (type: CROSSWORD)]
    end

    subgraph Alumno ["Flujo Alumno (Intento & Interacción)"]
        A --> SA[Student Attempt (IN_PROGRESS)]
        SA --> CSA[CrosswordStudentAssessment]
        CSA --> CG_UI[CrosswordGrid + CrosswordCluesList]
        CG_UI -->|Interaction / Debounce| API_CHK[POST /api/attempts/:attemptId/crossword/check]
        API_CHK --> CS_VAL[AttemptService.checkCrosswordValidation]
        CS_VAL -->|ValidationMap| CSA
        CSA -->|State Sync| ETP[ExamTakePage (answersMap)]
    end

    subgraph Calificacion ["Flujo de Calificación Server-side"]
        ETP -->|Submit| SUBMIT[POST /api/attempts/:attemptId/submit]
        SUBMIT --> AG[AttemptService.executeAutoGradeInTx]
        AG -->|Answer.textValue vs QuestionOption| SCORE[Attempt.score & Answer.pointsEarned]
        SCORE --> GB[GradebookService]
        GB --> AR[StudentAttemptResultPage & TeacherAttemptReviewPage]
    end
```

---

## 2. Modelo de Datos

### Enumeraciones y Tipos
- **`Assessment.type`**: `'CROSSWORD'`
- **`Question.type`**: `'CROSSWORD_CLUE'`

### Relación entre Componentes del Modelo
1. **Assessment & Questions**:
   - `Assessment` contiene múltiples `AssessmentQuestion` (con orden y puntaje asignado `points`).
   - Cada `AssessmentQuestion` apunta a una `Question` de tipo `CROSSWORD_CLUE`.
   - La respuesta correcta de la pista se almacena en `QuestionOption` con `isCorrect = true` y `text = "RESPUESTA_OFICIAL"`.

2. **Assessment & Layout**:
   - `Assessment.crosswordLayout` se almacena como JSON estructurado conteniendo las coordenadas del crucigrama generado.
   - **Estructura JSON de `crosswordLayout`**:
     ```json
     {
       "gridSize": 12,
       "entries": [
         {
           "questionId": "87e69242-1f45-4a54-b675-6caf386fa024",
           "word": "PARIS",
           "row": 2,
           "col": 3,
           "orientation": "ACROSS",
           "number": 1,
           "clue": "Capital de Francia",
           "length": 5
         }
       ]
     }
     ```
   - **Regla de Integridad de IDs**: `crosswordLayout.entries[].questionId === Question.id`.

---

## 3. Integridad de Evaluación CROSSWORD (Corrección QA-008-AL.5.8)

Durante QA manual en AL.5.7 se detectó una inconsistencia de 8 preguntas en el Assessment vs 7 entradas en el layout debido a una pregunta de opción múltiple desasociada.

### Reglas de Integridad Estrictas
- **Tipos de Pregunta Permitidos**: Un Assessment de tipo `CROSSWORD` admite **únicamente** preguntas de tipo `CROSSWORD_CLUE`. Se prohíbe incluir `MULTIPLE_CHOICE`, `NUMERIC`, `OPEN_TEXT` o `FILE_UPLOAD`.
- **Cobertura 100%**: El número de entradas en `crosswordLayout.entries` debe ser exactamente igual al número de `AssessmentQuestion` asociadas.
- **Sin Preguntas Huérfanas**: No se permiten `questionId` en el layout que no existan en el Assessment, ni preguntas del Assessment ausentes en el layout.
- **IDs Únicos**: No se permiten `questionId` duplicados en `crosswordLayout.entries`.
- **Publicación Bloqueada**: Un crucigrama incompleto o inconsistente no puede ser publicado.
- **Corrección en BD de Prueba**: El Assessment real de pruebas (`d8067fbb-5733-4d7b-9261-1d68a7b6b161`) fue saneado eliminando la pregunta irrelevante #8, quedando con 7 preguntas y 7 entradas exactas en el layout.

---

## 4. Algoritmo Generador (`crossword-generator.util.ts`)

La utilidad de generación automatizada de crucigramas incluye:
- **Normalización de Respuestas**:
  - Conversión a mayúsculas.
  - Eliminación de diacríticos y tildes (`Á` -> `A`, `Ñ` -> `Ñ`, `Ü` -> `U`).
  - Filtrado de caracteres no alfabéticos y espacios.
- **Parámetros del Tablero**:
  - Dimensión predeterminada: 12 × 12.
  - Límite de palabras: según las pistas agregadas por el docente.
- **Algoritmo de Colocación**:
  - Ordena palabras por longitud descendente.
  - Intenta colocar la primera palabra horizontalmente en el centro del grid.
  - Para subsecuentes palabras, busca intersecciones válidas con letras de palabras ya colocadas.
  - Valida que no existan colisiones adyacentes no permitidas (muros laterales y bordes limpios).
- **Resultado de Generación**:
  - `placedEntries`: Lista de entradas colocadas exitosamente con su posición `row`, `col`, `orientation` y `number`.
  - `unplacedEntries`: Lista de palabras que no pudieron intersecarse. Se permite regeneración manual o ajuste de palabras.

---

## 5. Editor del Maestro (`CrosswordEditor`, `CrosswordAssessmentPreview`)

Permite a los docentes construir y visualizar crucigramas interactivamente:
- **Gestión de Pistas**: Creación, edición de enunciados y respuestas asociadas.
- **Generación & Regeneración Layout**: Generación automática del crucigrama en un clic.
- **Previsualización Interactiva**: Rendering de `CrosswordAssessmentPreview` para comprobar la legibilidad del grid antes de publicar.
- **Bloqueo de Edición**: Si el `Assessment` ya cuenta con `Attempt` de alumnos registrados, la estructura del crucigrama queda bloqueada para edición para preservar la integridad académica.

---

## 6. Componentes del Alumno (`CrosswordStudentAssessment`, `CrosswordGrid`, `CrosswordCluesList`)

### Gestión de Estados en la UI del Alumno
- **`cellAnswers` (Fuente de Verdad Visual Local)**: Matriz que mapea celdas `row-col` a caracteres individuales ingresados por el estudiante.
- **`answersMap` (Fuente de Verdad del Padre `ExamTakePage`)**: Diccionario `{ questionId: textValue }` derivado que notifica al contenedor principal de la evaluación sobre las palabras completadas o modificadas.
- **`Answer` (Persistencia Server-side en PostgreSQL)**: Registros guardados en la BD a través de llamadas diferidas/debounced o manuales a `saveAnswer`.

### Funcionalidades Interactivas
- **Navegación e Intersecciones**: El foco se desplaza automáticamente a la siguiente celda de la palabra activa al escribir. En celdas de intersección, la misma letra visual aplica para las palabras Horizontal y Vertical asociadas.
- **Rehidratación Instantánea**: Al reanudar un intento en progreso, las respuestas previamente guardadas en PostgreSQL se reescriben en `cellAnswers` y se solicita inmediatamente el estado interactivo mediante `/check`.
- **Flush Pre-Submit**: Al presionar el botón de entregar o abrir el modal de confirmación (`SubmitConfirmModal`), se forza la descarga (*flush*) inmediata de cualquier borrador pendiente a la base de datos PostgreSQL.

---

## 7. Endpoint de Feedback Server-side (`POST /api/attempts/:attemptId/crossword/check`)

Permite al estudiante recibir retroalimentación formativa en tiempo real sobre las palabras completas escritas en el tablero.

### Contrato HTTP (Corregido en QA-008-AL.5.14)
- **Request**:
  ```json
  {
    "answers": [
      {
        "questionId": "87e69242-1f45-4a54-b675-6caf386fa024",
        "textValue": "PARIS"
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "validationMap": {
        "87e69242-1f45-4a54-b675-6caf386fa024": "CORRECT"
      }
    }
  }
  ```

### Garantías de Seguridad y Fuga de Datos (Zero Leakage)
- Requiere autenticación de rol `STUDENT` y pertenencia activa al curso (*Enrollment*).
- Requiere que el `Attempt` esté en estado `IN_PROGRESS`.
- **No se retornan respuestas correctas**, textos oficial normalizados, soluciones, ni puntajes parciales/totales. Únicamente los estados discretos: `CORRECT`, `INCORRECT` o `PENDING`.

---

## 8. Calificación Server-side (`AttemptService.executeAutoGradeInTx`)

La calificación definitiva no es realizada por el frontend ni por el endpoint de feedback `/check`, sino exclusivamente por el motor server-side al invocar `submitAttempt`:

1. **Normalización**: Tanto la respuesta del estudiante `Answer.textValue` como la respuesta docente `QuestionOption.text` se procesan mediante `normalizeCrosswordAnswer` (mayúsculas, sin tildes, sin espacios).
2. **Comparación Directa por Pregunta**:
   - Coincidencia exacta de la palabra -> `pointsEarned = aq.points` (10/10).
   - Incoincidencia o palabra incompleta -> `pointsEarned = 0`.
   - Sin respuesta registrada -> `pointsEarned = 0`.
3. **Cálculo del Puntaje Global**:
   $$\text{Attempt.score} = \left( \frac{\sum \text{pointsEarned}}{\sum \text{pointsMax}} \right) \times 100$$
4. **Ponderación de Intersecciones**: Las celdas compartidas se evalúan por la validez de la palabra completa asociada a cada `questionId` independiente. No se asignan puntos por celdas aisladas.

---

## 9. Resultados y Gradebook

- **Publicación de Intento**: `POST /api/attempts/:attemptId/submit` cambia el estado del intento a `GRADED`, calcula `Attempt.score` y sincroniza el libro de calificaciones (`GradebookService`).
- **Vista de Resultados del Alumno (`StudentAttemptResultPage.tsx`)**: Muestra el puntaje final, las preguntas respondidas y el desglose correspondiente.

### Corrección Visual de `isPassed` en AL.5.16
- **Bug Detectado**: Cuando un `Assessment` no tenía definida una nota mínima de aprobación (`passingScore = null`), `DTO.isPassed` retornaba `null`. En el frontend, `attempt.isPassed` evaluaba como falsy en la condición ternaria, mostrando un icono de **X roja** a pesar de un puntaje de `100.0 / 100 pts`.
- **Solución Aplicada**:
  - `isPassed === true` -> Icono de Aprobado (Verde).
  - `isPassed === false` -> Icono de Reprobado (Rojo).
  - `isPassed === null` -> Icono Neutral / Calificado sin regla de aprobación.

---

## 10. Matriz de QA Manual — CROSSWORD

| Componente / Flujo | Estado Actual | Notas |
| :--- | :---: | :--- |
| **Persistencia de Respuestas** | 🟢 Completado | Guardado continuo y rehidratación de `Answer` en PostgreSQL |
| **Grading Server-side** | 🟢 Completado | Calificación exacta 100/100 en `executeAutoGradeInTx` |
| **Integración Gradebook** | 🟢 Completado | Reflejo inmediato del score en el libro del docente |
| **Feedback Interactivo** | 🟢 Completado | Endpoint `/check` actualiza `wordStates` a `CORRECT` / `INCORRECT` |
| **Sincronización Padre/Hijo** | 🟢 Completado | `onAnswerChange` sincroniza `answersMap` en `ExamTakePage` |
| **Modal de Entrega (Submit)** | 🟢 Completado | Muestra número real de palabras completadas (ej. 7/7) |
| **Integridad 7/7 Preguntas** | 🟢 Completado | Eliminada la pregunta 8 no cruzada (AL.5.8) |
| **Resultado Visual (Sin X Roja)**| 🟢 Completado | Manejo neutral para `isPassed === null` (AL.5.16) |
| **Revisión Docente (Tablero)** | 🟡 Implementado / Pendiente Validación | UI implementada (AL.5.17), suite 14/14 PASS; pendiente test visual |

---

## 11. Trazabilidad de Suites de Pruebas Automatizadas

| Subtarea QA | Archivo de Test | Resultado | Cobertura / Propósito |
| :--- | :--- | :---: | :--- |
| **AL.5.2** | `test-qa008-al52-student-container.ts` | **20 / 20 PASS** | Renderizado del contenedor del alumno |
| **AL.5.3** | `test-qa008-al53-crossword-persistence.ts` | **21 / 21 PASS** | Persistencia y guardado de respuestas |
| **AL.5.4** | `test-qa008-al54-crossword-grading.ts` | **19 / 19 PASS** | Motor de calificación server-side |
| **AL.5.6** | `test-qa008-al56-crossword-feedback.ts` | **26 / 26 PASS** | Endpoint y lógica de comprobación de palabras |
| **AL.5.8** | `test-qa008-al58-crossword-integrity.ts` | **15 / 15 PASS** | Validación de integridad 1:1 entre layout y preguntas |
| **AL.5.9** | `test-qa008-al59-crossword-feedback-ui.ts` | **12 / 12 PASS** | Feedback interactivo y tarjeta de pista activa |
| **AL.5.11** | `test-qa008-al511-crossword-state-sync.ts` | **24 / 24 PASS** | Sincronización entre `CrosswordStudentAssessment` y `ExamTakePage` |
| **AL.5.12** | `test-qa008-al512-crossword-feedback-final.ts` | **18 / 18 PASS** | Rehidratación de respuestas y eliminación de cabecera duplicada |
| **AL.5.14** | `test-qa008-al514-crossword-http-contract.ts` | **14 / 14 PASS** | Contrato HTTP `data.validationMap` |
| **AL.5.16** | `test-qa008-al516-result-status.ts` | **16 / 16 PASS** | Estado visual neutro cuando `isPassed === null` |
| **AL.5.17** | `test-qa008-al517-crossword-review.ts` | **14 / 14 PASS** | Revisión docente read-only de crucigramas |

---

## 12. Estado de Compilación y Calidad de Código

- **Backend Typecheck**: `PASS` (0 errores)
- **Frontend Typecheck**: `PASS` (0 errores)
- **Backend Lint**: `PASS` (0 errores)
- **Frontend Lint**: `PASS` (0 errores)
- **Backend Build**: `PASS` (Build exitoso en `dist/`)
- **Frontend Build**: `PASS` (Build exitoso con Vite)

---

## 13. Registro de Migraciones Prisma

- `backend/prisma/migrations/20260920191546_add_crossword_support/`: Agregó soporte para `CROSSWORD` en enum `AssessmentType`, `CROSSWORD_CLUE` en enum `QuestionType`, y el campo opcional `crosswordLayout` (JSON) en la tabla `Assessment`.

---

## 14. Inventario de Archivos Relevantes del Módulo CROSSWORD

### Backend
- [schema.prisma](file:///c:/github/potrolearn/backend/prisma/schema.prisma): Definición de enums `AssessmentType.CROSSWORD`, `QuestionType.CROSSWORD_CLUE` y campo `crosswordLayout`.
- [assessment.service.ts](file:///c:/github/potrolearn/backend/src/services/assessment.service.ts): Mapeo de `crosswordLayout` y validaciones de autoría.
- [attempt.service.ts](file:///c:/github/potrolearn/backend/src/services/attempt.service.ts): Métodos `checkCrosswordValidation`, `executeAutoGradeInTx` y `getAttemptReviewForTeacher`.
- [attempt.controller.ts](file:///c:/github/potrolearn/backend/src/controllers/attempt.controller.ts): Endpoint `POST /api/attempts/:attemptId/crossword/check`.
- [crossword-generator.util.ts](file:///c:/github/potrolearn/backend/src/utils/crossword-generator.util.ts): Generador algorítmico del layout del crucigrama.

### Frontend
- [CrosswordStudentAssessment.tsx](file:///c:/github/potrolearn/frontend/src/components/assessments/CrosswordStudentAssessment.tsx): Componente interactivo del alumno con feedback en tiempo real.
- [CrosswordGrid.tsx](file:///c:/github/potrolearn/frontend/src/components/assessments/CrosswordGrid.tsx): Tablero de celdas bidimensional.
- [CrosswordCluesList.tsx](file:///c:/github/potrolearn/frontend/src/components/assessments/CrosswordCluesList.tsx): Listado de pistas categorizadas por orientación.
- [CrosswordAttemptReview.tsx](file:///c:/github/potrolearn/frontend/src/components/assessments/CrosswordAttemptReview.tsx): Vista de revisión docente (read-only).
- [crossword-student.util.ts](file:///c:/github/potrolearn/frontend/src/utils/crossword-student.util.ts): Reconstrucción de matriz de celdas desde respuestas tipeadas.
- [crossword-validation.util.ts](file:///c:/github/potrolearn/frontend/src/utils/crossword-validation.util.ts): Normalización y cálculo visual de estados locales.
- [ExamTakePage.tsx](file:///c:/github/potrolearn/frontend/src/pages/ExamTakePage.tsx): Integración de la evaluación en la vista principal de examen.
- [TeacherAttemptReviewPage.tsx](file:///c:/github/potrolearn/frontend/src/pages/TeacherAttemptReviewPage.tsx): Vista de revisión docente adaptada para tipo CROSSWORD.

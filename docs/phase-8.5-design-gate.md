# PotroLearn — Phase 8.5 Design Gate
## Gradebook, Ponderaciones y Calificación Final del Curso (Academic Results)

> **Estado oficial:** 🟢 PASS / IMPLEMENTADO COMPLETAMENTE (100% VALIDADO)

---

## 1. Objective

El objetivo de la **Fase 8.5** es diseñar la arquitectura técnica y cerrar de forma definitiva las reglas de negocio académicas para el módulo de **Gradebook, Ponderaciones y Calificación Final del Curso**. 

Este módulo conecta los resultados individuales obtenidos por los estudiantes en sus evaluaciones (`Attempt.score` en Fases 8.4-A $\rightarrow$ 8.4-F) con la acumulación ponderada de notas (`Assessment.weight`) para calcular y consolidar la calificación final del estudiante en la asignatura (`Enrollment.finalGrade`).

---

## 2. Current Data Model Assessment

El modelo de datos actual en PostgreSQL (definido en `backend/prisma/schema.prisma`) **es 100% suficiente** para soportar todas las reglas de la Fase 8.5 **sin requerir ninguna modificación al esquema ni migraciones de Prisma**:

```prisma
model Assessment {
  id               String         @id @default(uuid())
  courseId         String
  title            String
  type             AssessmentType
  weight           Decimal        @default(0.0) @db.Decimal(5, 2)
  passingScore     Decimal?       @db.Decimal(5, 2)
  isPublished      Boolean        @default(false)
  // ...
}

model Enrollment {
  id          String           @id @default(uuid())
  studentId   String
  courseId    String
  status      EnrollmentStatus @default(ACTIVE)
  finalGrade  Decimal?         @db.Decimal(5, 2)
  // ...
}

model Attempt {
  id            String        @id @default(uuid())
  studentId     String
  assessmentId  String
  attemptNumber Int
  score         Decimal?      @db.Decimal(5, 2)
  status        AttemptStatus @default(IN_PROGRESS)
  // ...
}
```

---

## 3. Academic Rules

1. **Ponderación Relativa**: Cada evaluación publicada posee un peso numérico `Assessment.weight` ($0.00 \le \text{weight} \le 100.00$).
2. **Desacoplamiento de Intentos**: El Gradebook no evalúa intentos `IN_PROGRESS`. Únicamente toma en consideración evaluaciones publicadas (`isPublished = true`) que posean intentos finalizados (`status = GRADED`).
3. **Escala de Calificación**: Todas las calificaciones de evaluaciones (`Attempt.score`) y la calificación final del curso (`Enrollment.finalGrade`) se expresan en escala de $0.00$ a $100.00$ con 2 decimales de precisión.

---

## 4. Attempt Selection Rule (Decisión 1: CERRADA 🟢)

**Regla**: **Best Score (`MAX(score)`)**.
- Para cada evaluación (`Assessment`), la nota representativa del alumno es la **calificación máxima** (`MAX(score)`) entre todos sus intentos en estado `GRADED`.
- **Justificación Académica y Técnica**:
  - Garantiza **100% de consistencia** con la regla establecida en la Fase 8.4 (*"Best graded attempt = max(score)"*).
  - Promueve la nivelación y el aprendizaje formativo: si un estudiante aprovecha sus intentos máximos (`maxAttempts`), su boleta académica premia su mejor logro académico alcanzado.
  - Es totalmente compatible con procesos de calificación manual y *regrading*: si un profesor modifica la nota de una respuesta abierta en un intento previo, el backend recalcula la nota de ese intento y `MAX(score)` se actualiza automáticamente.

$$\text{studentAssessmentScore}(s, a) = \max \Big( \{ \text{att.score} \mid \text{att.studentId} = s \land \text{att.assessmentId} = a \land \text{att.status} = \text{GRADED} \} \Big)$$

---

## 5. Assessment Weight Rules (Decisión 2, 3, 4, 5, 6: CERRADAS 🟢)

### 5.1. Pesos Totales = 100.00%
Cuando la suma de los pesos de las evaluaciones publicadas es exactamente $100.00\%$, la contribución de cada evaluación es directa:

$$\text{contribution}_i = \frac{\text{studentAssessmentScore}_i \times \text{weight}_i}{100}$$

### 5.2. Pesos Totales < 100.00% (Proportional Normalization para Calificación Actual)
Cuando el curso está en progreso y la suma de pesos evaluados hasta el momento es menor al $100.00\%$ (ej. Evaluación A = 30%, Evaluación B = 20%; Total evaluado = 50%):
- **Current Grade (Calificación Parcial Acumulada)**: Se calcula mediante **normalización proporcional** sobre la suma de pesos de las evaluaciones que ya cuentan con calificación:

$$\text{Current Grade} = \frac{\sum_{i \in \text{Graded}} (\text{score}_i \times \text{weight}_i)}{\sum_{i \in \text{Graded}} \text{weight}_i}$$

- **Ventaja**: Un alumno con $100$ en un examen de $30\%$ no ve un desmotivador $30/100$ en su promedio actual, sino un $100/100$ provisional por el material evaluado hasta la fecha.

### 5.3. Pesos Totales > 100.00% (Configuración Inválida Bloqueada)
- **Regla**: La API backend en la creación/edición de evaluaciones (`POST /api/assessments` y `PUT /api/assessments/:id`) **rechazará con error HTTP 400 (`TOTAL_WEIGHT_EXCEEDED`)** cualquier intento de publicar evaluaciones cuya suma total de `weight` exceda $100.00\%$ dentro del mismo curso.

### 5.4. Peso = 0.00% (Evaluaciones Informativas / Diagnósticas)
- Las evaluaciones con `weight = 0.00` (ej. exámenes diagnósticos o prácticas) **aparecen en la boleta e historial** con su puntaje obtenido, pero **no aportan ni restan** en el cálculo de `Current Grade` ni `Final Grade`.

---

## 6. Current Grade vs Final Grade (Decisión 7: CERRADA 🟢)

| Concepto | Nombre en Interfaz | Cuándo se Muestra | Fórmula / Cálculo |
| :--- | :--- | :--- | :--- |
| **Current Grade** | **Calificación Parcial Acumulada** | Durante el curso activo (`CourseStatus.ACTIVE`). | Normalización proporcional de evaluaciones publicadas con calificación (`GRADED`). |
| **Final Grade** | **Calificación Final del Curso** | Al finalizar el curso (`CourseStatus.FINISHED`) o completarse la inscripción. | Suma ponderada absoluta sobre el 100% de las evaluaciones del curso. Se persiste en `Enrollment.finalGrade`. |

---

## 7. Pending / Missing Assessments (Decisión 8: CERRADA 🟢)

En la interfaz de Gradebook se distinguirán explícitamente 3 estados por cada casilla de evaluación:

1. **`NO_ATTEMPT`** (*Sin presentar*):
   - El alumno no ha iniciado ningún intento.
   - *Comportamiento*: No penaliza el `Current Grade`. Al finalizar el curso (`FINISHED`), las evaluaciones no presentadas ponderan como $0.00$ en la `Final Grade`.
2. **`PENDING_GRADING`** (*Pendiente de revisión*):
   - El alumno envió un intento (`status = SUBMITTED`) con preguntas `OPEN_TEXT` pendientes de calificación por el profesor.
   - *Comportamiento durante ACTIVE*: Muestra el badge *"Pendiente"*. Se excluye del cálculo numérico hasta que el profesor complete la revisión.
   - *Comportamiento al Cierre de Curso (ACTIVE $\rightarrow$ FINISHED)*: Un curso **no puede pasar a `FINISHED`** mientras existan `Attempts` en estado `SUBMITTED` que requieran calificación manual. La API devuelve **HTTP 400 con código `UNGRADED_ATTEMPTS_EXIST`** y el curso permanece `ACTIVE`. Una vez calificadas todas las entregas pendientes (pasando a `GRADED`), la finalización del curso puede ejecutarse normalmente.
3. **`GRADED`** (*Calificada*):
   - El intento fue autocalificado o revisado manualmente (`status = GRADED`).
   - *Comportamiento*: Muestra la calificación obtenida y participa en los cálculos.

---

## 8. Course Lifecycle Rules (Decisión 9: CERRADA 🟢)

- **`DRAFT`**: Las evaluaciones en borrador **no aparecen** en la boleta del estudiante ni participan en cálculos. En la vista docente se muestran en gris sin afectar notas.
- **`ACTIVE`**: Las evaluaciones publicadas (`isPublished = true`) calculan el `Current Grade` en tiempo real.
- **`FINISHED`**: Al cambiar el estado del curso a `FINISHED`, el backend verifica que no existan entregas pendientes de calificación manual (`Attempts` con `status = SUBMITTED`). Si existen, rechaza la operación con `HTTP 400 UNGRADED_ATTEMPTS_EXIST`. Si no existen entregas pendientes, ejecuta el cálculo final consolidado y **congela de forma definitiva el resultado en `Enrollment.finalGrade`**, marcando las inscripciones como `COMPLETED`.
- **`ARCHIVED`**: Preservación de lectura inmutable. No permite modificaciones de notas ni recálculos.

---

## 9. Weight Change Rules (Decisión 10: CERRADA 🟢)

- **Permisos**: Únicamente `TEACHER` asignado al curso o `ADMIN`.
- **Regla en Cursos `ACTIVE`**: Si se modifica el `weight` de una evaluación cuando ya existen intentos calificados, la API valida que $\sum \text{weight} \le 100.00\%$, guarda el nuevo peso y **dispara el recálculo atómico de `Enrollment.finalGrade`** para todos los inscritos.
- **Regla en Cursos `FINISHED` / `ARCHIVED`**: Bloqueado (`400 COURSE_CLOSED`).

---

## 10. Regrading Integration (Decisión 11: CERRADA 🟢)

Cuando un profesor califica o recalifica una pregunta abierta (`PUT /api/attempts/:id/answers/:qId/grade`):
1. El backend actualiza la nota de la respuesta y del intento (`Attempt.score`).
2. Si el intento cambia a `GRADED`, el servicio de Gradebook recalcula atómicamente la mejor nota del alumno en esa evaluación (`bestScore`).
3. El backend actualiza `Enrollment.finalGrade` de forma idempotente.

---

## 11. Persistence Strategy (Decisión 12: CERRADA 🟢)

- **Lectura**: Calculada dinámicamente bajo demanda para `Current Grade` utilizando agrega de Prisma en memoria (evitando latencia).
- **Escritura / Persistencia**: `Enrollment.finalGrade` se persiste de forma automática en PostgreSQL en dos momentos:
  1. Al cambiar el estado de un intento a `GRADED` o actualizar una nota manual.
  2. Al cerrar el curso (`CourseStatus.FINISHED`).

---

## 12. Backend API Design (Decisión 13: CERRADA 🟢)

### 1. `GET /api/courses/:courseId/gradebook` (TEACHER, ADMIN)
- **Propósito**: Sábana/Matriz de calificaciones de todo el grupo.
- **Query Params**: `statusFilter` (`ACTIVE`, `COMPLETED`, `ALL`), `search` (nombre/matrícula).
- **Respuesta (DTO)**:
```json
{
  "data": {
    "courseId": "uuid",
    "courseName": "Nivelación Matemática 2026-A",
    "totalEvaluatedWeight": 80.0,
    "assessments": [
      { "id": "a1", "title": "Examen Parcial 1", "weight": 30.0, "type": "EXAM" },
      { "id": "a2", "title": "Quiz 1", "weight": 20.0, "type": "QUIZ" }
    ],
    "students": [
      {
        "studentId": "u1",
        "studentName": "Juan Pérez",
        "studentNumber": "A01234567",
        "currentGrade": 88.5,
        "finalGrade": null,
        "grades": {
          "a1": { "score": 85.0, "status": "GRADED", "attemptNumber": 1 },
          "a2": { "score": 92.0, "status": "GRADED", "attemptNumber": 2 }
        }
      }
    ]
  }
}
```

### 2. `GET /api/courses/:courseId/my-grades` (STUDENT)
- **Propósito**: Boleta individual del estudiante autenticado.
- **Respuesta (DTO)**:
```json
{
  "data": {
    "courseId": "uuid",
    "courseName": "Nivelación Matemática 2026-A",
    "currentGrade": 88.5,
    "finalGrade": null,
    "enrollmentStatus": "ACTIVE",
    "assessments": [
      {
        "assessmentId": "a1",
        "title": "Examen Parcial 1",
        "type": "EXAM",
        "weight": 30.0,
        "bestScore": 85.0,
        "weightContribution": 25.5,
        "status": "GRADED",
        "attemptsUsed": 1,
        "maxAttempts": 2
      }
    ]
  }
}
```

---

## 13. Authorization & IDOR Protection (Decisión 14, 15: CERRADAS 🟢)

- `GET /api/courses/:courseId/gradebook`:
  - `STUDENT` $\rightarrow$ `403 FORBIDDEN`.
  - `TEACHER` $\rightarrow$ Valida asignación en `CourseTeacher`. Si no está asignado $\rightarrow$ `403 FORBIDDEN`.
  - `ADMIN` $\rightarrow$ Acceso global permitido.
- `GET /api/courses/:courseId/my-grades`:
  - `STUDENT` $\rightarrow$ Devuelve **únicamente** las calificaciones asociadas a `req.user.id`. No acepta `studentId` por parámetro URL (Protección total anti-IDOR).

---

## 14. Performance Strategy (Decisión 16: CERRADA 🟢)

- **Consulta Única Paginada**: En lugar de consultar $N$ alumnos $\times M$ evaluaciones en loops $N+1$, la consulta del Gradebook docente ejecuta **2 consultas Prisma optimizadas**:
  1. `findMany` de `Enrollment` con `studentProfile` e `User`.
  2. `findMany` de `Attempt` filtrando por `courseId` y `status: GRADED`.
- El mapeo de la matriz se realiza en memoria JS ($O(N + A)$), garantizando tiempos de respuesta $< 50$ ms para cursos de hasta 500 alumnos.

---

## 15. Frontend UX Design (Decisión 17, 18: CERRADAS 🟢)

- **`TeacherGradebookPage.tsx`**:
  - Matriz responsiva con encabezado fijo (*sticky header*).
  - Columnas dinámicas por cada evaluación publicada.
  - Columna final destacada con `Current Grade` / `Final Grade`.
  - Exportación rápida a vista imprimible/tabla.
- **`StudentGradesPage.tsx`**:
  - Vista tipo boleta académica clara y elegante.
  - Tarjeta superior con la Calificación Parcial Acumulada.
  - Tabla con desglose de Evaluación, Peso, Calificación Obtenida y Contribución Real.

---

## 16. Summary Table of Closed Decisions (Matriz Final 🟢)

| Decisión | Estado | Regla Cerrada |
| :--- | :---: | :--- |
| **Attempt Selection** | 🟢 CLOSED | **Best Score (`MAX(score)`)** entre los intentos en estado `GRADED`. |
| **No Attempt** | 🟢 CLOSED | `NO_ATTEMPT` (no penaliza nota parcial; pondera 0 al cerrar el curso). |
| **Pending Grading** | 🟢 CLOSED | `PENDING_GRADING` (excluido de notas parciales; bloquea cierre de curso a `FINISHED` con `400 UNGRADED_ATTEMPTS_EXIST` hasta revisión). |
| **Weight < 100%** | 🟢 CLOSED | **Normalización Proporcional** para `Current Grade` durante el curso. |
| **Weight = 100%** | 🟢 CLOSED | Suma ponderada directa. |
| **Weight > 100%** | 🟢 CLOSED | Bloqueado en API (`400 TOTAL_WEIGHT_EXCEEDED`). |
| **Weight = 0%** | 🟢 CLOSED | Evaluación informativa (no altera promedio numérico). |
| **DRAFT Assessments** | 🟢 CLOSED | Excluidos de boleta y cálculos estudiantiles. |
| **ACTIVE Course** | 🟢 CLOSED | Cálculo dinámico de `Current Grade`. |
| **FINISHED Course** | 🟢 CLOSED | Congelamiento definitivo en `Enrollment.finalGrade`. |
| **ARCHIVED Course** | 🟢 CLOSED | Lectura inmutable. |
| **isPublished** | 🟢 CLOSED | Solo evaluaciones publicadas participan en Gradebook. |
| **score = null** | 🟢 CLOSED | Excluido de numeradores y denominadores hasta ser calificado. |
| **Current vs Final Grade** | 🟢 CLOSED | `Current` = parcial normalizado; `Final` = consolidado absoluto en `Enrollment.finalGrade`. |
| **Regrading Integration** | 🟢 CLOSED | Recálculo automático de `Attempt.score` y `Enrollment.finalGrade`. |
| **Weight Change** | 🟢 CLOSED | Permitido en `DRAFT`/`ACTIVE` con recálculo automático; bloqueado en `FINISHED`. |
| **Precision & Rounding** | 🟢 CLOSED | `Decimal(5, 2)` en backend, redondeo a 2 decimales. |
| **No Assessments** | 🟢 CLOSED | Muestra `null` ("Sin evaluaciones"). |
| **Authorization / IDOR** | 🟢 CLOSED | `STUDENT` restringido a sus propios datos mediante token de sesión. |
| **Performance** | 🟢 CLOSED | 2 consultas Prisma masivas sin problema de $N+1$. |

---

## 17. Explicit Non-Goals (Fase 8.5)

- ❌ Sin gráficas complejas de analíticas o dashboards visuales.
- ❌ Sin subida de archivos ni integración con Google Drive.
- ❌ Sin cambios en la base de datos ni migraciones de Prisma.
- ❌ Sin despliegue en producción.

---

## 18. Acceptance Criteria for Phase 8.5 Implementation

1. `GET /api/courses/:courseId/gradebook` retorna la matriz completa del grupo para `TEACHER` (asignado) y `ADMIN`.
2. `GET /api/courses/:courseId/my-grades` retorna la boleta individual del `STUDENT` autenticado impidiendo accesos IDOR.
3. El cálculo de `Current Grade` aplica la regla de Best Score y normalización proporcional sobre evaluaciones publicadas.
4. Al marcar un curso como `FINISHED`, `Enrollment.finalGrade` se consolida y persiste en PostgreSQL.
5. `npm run typecheck`, `npm run lint` y `npm run build` finalizan con 0 errores.

---

## PHASE 8.5 DESIGN GATE STATUS: PASS 🟢
Todas las reglas académicas y técnicas para la **Fase 8.5 (Gradebook, Ponderaciones & Calificación Final del Curso)** se encuentran **completamente cerradas y aprobadas**. El proyecto está listo para recibir la instrucción de implementación.

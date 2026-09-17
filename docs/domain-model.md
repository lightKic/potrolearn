# Modelo de Dominio PotroLearn V1 (Aprobado para Implementación + Auth Schema V1 Definitivo)

Este documento establece la especificación formal del modelo de dominio, entidades, relaciones, reglas de integridad, ciclo de vida de cursos, autenticación y evaluaciones para la plataforma educativa **PotroLearn**.

---

## 1. Descripción General

**PotroLearn** es una plataforma web de gestión del aprendizaje (LMS) orientada inicialmente a cursos de regularización y nivelación matemática a nivel universitario. Su arquitectura de dominio es estrictamente **agnóstica a la materia**, lo que permite crear y administrar cursos de cualquier disciplina académica (Programación, Física, Cálculo, Inglés, etc.).

### Principios Fundamentales del Dominio V1
1. **Desacoplamiento Contenido vs. Operación**: La estructura académica y material instruccional de un curso (módulos, lecciones, evaluaciones, preguntas) es reutilizable y existe independientemente de los datos generados por las cohortes de estudiantes (inscripciones, progreso, intentos, respuestas, calificaciones).
2. **Reutilización y Clonación**: Los cursos pueden duplicarse entre diferentes periodos académicos sin arrastrar información operativa de estudiantes de periodos anteriores.
3. **Simplicidad Académica (YAGNI)**: Se eliminan estructuras innecesarias para el MVP (ej. `TeacherProfile`, subroles complejos en `CourseTeacher` o entidades complejas de versión de reactivos), priorizando un modelo limpio, seguro y extensible.
4. **Identidad Única**: Cada usuario posee una sola cuenta en el sistema (`User`), pudiendo asumir uno de los roles globales oficiales.
5. **Provisionamiento de Cuentas por Invitación**: Sin registro público. Los alumnos son provisionados por maestros o administradores generando credenciales temporales y tokens de activación con expiración.

---

## 2. Roles y Matriz de Responsabilidades

PotroLearn define strictly **tres roles globales únicos**:

```text
ADMIN
TEACHER
STUDENT
```

En la interfaz de usuario se muestran como:
- **Administrador** (`ADMIN`)
- **Maestro** (`TEACHER`)
- **Alumno** (`STUDENT`)

| Rol Interno | Nombre en Interfaz | Responsabilidades Principales |
| :--- | :--- | :--- |
| `ADMIN` | **Administrador** | - Gestión global de usuarios (Crear, activar, desactivar, asignar rol).<br>- Gestión de materias (`Subject`).<br>- Supervisión y administración de cursos.<br>- Consulta de estadísticas y analíticas a nivel plataforma. |
| `TEACHER` | **Maestro** | - Creación de cursos (inician en estado `DRAFT`).<br>- Asignación de maestros colaboradores a sus cursos.<br>- Gestión e inscripción de alumnos (individual o importación futura).<br>- Construcción de la estructura académica (Módulos, Lecciones, Evaluaciones, Banco de Preguntas).<br>- Calificación de evaluaciones abiertas, seguimiento de progreso y consulta de calificaciones de sus cursos.<br>- Reenvío de invitaciones y restablecimiento de contraseñas de sus alumnos. |
| `STUDENT` | **Alumno** | - Activación de cuenta y cambio obligatorio de contraseña inicial.<br>- Acceso a los cursos donde esté activamente inscrito (`Enrollment`).<br>- Navegación por módulos y lectura de lecciones.<br>- Registro de avance de lectura (`LessonProgress`).<br>- Realización de actividades y cuestionarios en sus intentos correspondientes (`Attempt`).<br>- Consulta personal de calificaciones e historial de progreso. |

---

## 3. Entidades Propuestas y Reglas de Negocio V1

### 3.1. Identidad, Usuarios y Autenticación
- **`User`**: Cuenta de acceso e identidad principal en el sistema.
  - *Regla*: `email` es único y se normaliza en minúsculas. Un usuario posee exactamente un rol global (`ADMIN`, `TEACHER` o `STUDENT`).
  - *Soporte de Autenticación*:
    - `passwordHash`: Hash seguro de la contraseña (**NOT NULL**). Toda cuenta creada en V1 posee credencial de acceso local.
    - `mustChangePassword`: Flag booleano (`true` cuando la cuenta tiene una contraseña temporal creada por el sistema).
    - `isActive`: Flag booleano de autorización administrativa (`default: true`).
    - `activatedAt`: Marca de tiempo que registra cuando el usuario completó la activación inicial (nullable).
    - `lastLoginAt`: Marca de tiempo del último inicio de sesión exitoso (nullable).
  - *Campos*: `id`, `email`, `name`, `role`, `passwordHash`, `mustChangePassword`, `isActive`, `activatedAt`, `lastLoginAt`, `createdAt`, `updatedAt`.
- **`StudentProfile`**: Perfil complementario obligatorio para usuarios con rol `STUDENT`.
  - *Regla*: Relación 1:1 con `User`. Contiene la matrícula o código estudiantil (`studentNumber`), el cual es **globalmente único** en el sistema para simplificar el MVP e impedir matrículas duplicadas.
  - *Campos*: `id`, `userId`, `studentNumber`, `createdAt`, `updatedAt`.
- **`AuthToken`**: Tokens temporales para activación de cuenta e inicio/restablecimiento de contraseña.
  - *Regla*: Almacena exclusivamente el hash del token (`tokenHash`, único). Soporta expiración (`expiresAt`), consumo (`usedAt`) e invalidación explícita por reenvío (`revokedAt`). Relación 1:N con `User` (`onDelete: Cascade`).
  - *Tipos (`TokenType`)*: `ACCOUNT_ACTIVATION`, `PASSWORD_RESET`.
  - *Campos*: `id`, `userId`, `type`, `tokenHash`, `expiresAt`, `usedAt`, `revokedAt`, `createdAt`.

### 3.2. Estructura Académica y Cursos
- **`Subject`**: Materia o disciplina académica general (ej. "Matemáticas", "Programación", "Física").
- **`Course`**: Instancia concreta de un curso impartido en un periodo determinado (ej. "Nivelación Matemática 2026-A").
- **`CourseTeacher`**: Relación M:N entre `Course` y `User` (Maestros).
- **`Enrollment`**: Inscripción y participación de un alumno en un curso.

---

## 4. Relaciones y Cardinalidades

```text
User             1 ─── N  AuthToken
User             1 ─── 1  StudentProfile (STUDENT)
Subject          1 ─── N  Course
Course           1 ─── N  CourseTeacher      N ─── 1  User (TEACHER)
Course           1 ─── N  Enrollment         N ─── 1  User (STUDENT)
Enrollment       1 ─── N  LessonProgress     N ─── 1  Lesson
Course           1 ─── N  Module             1 ─── N  Lesson
Course           1 ─── N  Assessment
Assessment       1 ─── N  AssessmentQuestion N ─── 1  Question
Question         1 ─── N  QuestionOption
User (STUDENT)   1 ─── N  Attempt            N ─── 1  Assessment
Attempt          1 ─── N  Answer             N ─── 1  Question
Answer           1 ─── N  AnswerOption       N ─── 1  QuestionOption
```

---

## 5. Lifecycle del Token de Autenticación (`AuthToken`)

El estado del token se deriva de sus atributos temporales:

```text
       ┌──────────┐
       │ CREATED  │
       └────┬─────┘
            │
            ▼
       ┌──────────┐
       │  ACTIVE  │ (usedAt = null AND revokedAt = null AND expiresAt > now)
       └────┬─────┘
            ├──────────────────────┬──────────────────────┐
            ▼                      ▼                      ▼
     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
     │   CONSUMED   │       │   EXPIRED    │       │   REVOKED    │
     │(usedAt!=null)│       │(expiresAt<=now)     │(revokedAt!=null)
     └──────────────┘       └──────────────┘       └──────────────┘
```

1. **`ACTIVE`**: `usedAt = null AND revokedAt = null AND expiresAt > now` (Token válido para consumir).
2. **`CONSUMED`**: `usedAt != null` (Redimido exitosamente por el alumno al cambiar su contraseña).
3. **`EXPIRED`**: `usedAt = null AND revokedAt = null AND expiresAt <= now` (Súperó la vigencia de 2 horas sin ser usado).
4. **`REVOKED`**: `revokedAt != null` (Invalidado por acción docente al pulsar "Reenviar invitación").

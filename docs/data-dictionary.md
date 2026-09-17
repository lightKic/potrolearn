# Diccionario de Datos Conceptual V1 - PotroLearn (con Auth Schema V1 Definitivo)

Este documento describe la estructura detallada de las entidades conceptuales, campos, tipos abstractos de datos, restricciones de nulidad y observaciones para la plataforma **PotroLearn V1**.

---

## 1. Identidad, Usuarios y Autenticación

### 1.1. `User` (Usuario)
Representa la cuenta de acceso e identidad principal de cualquier persona en el sistema.

| Campo | Tipo conceptual | Obligatorio | Descripción | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Sí | Identificador único del usuario | Clave primaria |
| `email` | String | Sí | Correo electrónico institucional o personal | Único. Normalizado en minúsculas |
| `name` | String | Sí | Nombre completo del usuario | Utilizado para interfaz y listas |
| `role` | Enum | Sí | Rol global del usuario en la plataforma | Valores: `ADMIN`, `TEACHER`, `STUDENT` |
| `passwordHash` | String | Sí | Hash de contraseña seguro | **NOT NULL**. Toda cuenta V1 posee credencial local |
| `mustChangePassword` | Boolean | Sí | Obliga a cambiar la contraseña temporal | Defecto `false`. `true` en invitaciones |
| `isActive` | Boolean | Sí | Estado de autorización de la cuenta | Por defecto `true`. Desactivación administrativa |
| `activatedAt` | Timestamp | No | Fecha/hora de activación por usuario | Nullable. Registra cuando completó primer acceso |
| `lastLoginAt` | Timestamp | No | Fecha/hora de último inicio de sesión | Nullable. Actualizado en inicio exitoso |
| `createdAt` | Timestamp | Sí | Fecha de registro en el sistema | Autogenerado |
| `updatedAt` | Timestamp | Sí | Fecha de última modificación | Autoupdated |

---

### 1.2. `StudentProfile` (Perfil de Alumno)
Información académica específica vinculada a usuarios con rol `STUDENT`.

| Campo | Tipo conceptual | Obligatorio | Descripción | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Sí | Identificador del perfil | Clave primaria |
| `userId` | UUID | Sí | Referencia al usuario correspondiente | Clave foránea 1:1 hacia `User`. `UNIQUE` |
| `studentNumber` | String | Sí | Matrícula o código estudiantil único | Único global (`UNIQUE`). Importaciones |
| `createdAt` | Timestamp | Sí | Fecha de creación del perfil | Autogenerado |
| `updatedAt` | Timestamp | Sí | Fecha de actualización | Autoupdated |

---

### 1.3. `AuthToken` (Token de Autenticación Temporal)
Tokens temporales con expiración para activación de cuenta y restablecimiento de contraseña.

| Campo | Tipo conceptual | Obligatorio | Descripción | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Sí | Identificador único del token | Clave primaria |
| `userId` | UUID | Sí | Usuario al que se emite el token | Clave foránea N:1 hacia `User` (`onDelete: Cascade`). Índice `(userId, type)` |
| `type` | Enum | Sí | Tipo de propósito del token | Valores: `ACCOUNT_ACTIVATION`, `PASSWORD_RESET` |
| `tokenHash` | String | Sí | Hash único del token enviado por URL | Único (`UNIQUE`). Nunca en texto plano |
| `expiresAt` | Timestamp | Sí | Fecha/hora de vencimiento del token | Calculado por backend (ej. `now + 2h`). Índice `expiresAt` |
| `usedAt` | Timestamp | No | Fecha/hora de consumo exitoso | Nullable. `null` = no consumido |
| `revokedAt` | Timestamp | No | Fecha/hora de invalidación manual/reenvío | Nullable. `null` = no revocado |
| `createdAt` | Timestamp | Sí | Fecha de emisión del token | Autogenerado |

---

## 2. Estructura Académica y Cursos
### 2.1. `Subject` (Materia / Disciplina)
### 2.2. `Course` (Curso / Cohorte)
### 2.3. `CourseTeacher` (Maestros Asignados al Curso)
### 2.4. `Enrollment` (Inscripción de Alumno)

---

## 3. Contenido Pedagógico y Progreso
### 3.1. `Module` (Módulo Temático)
### 3.2. `Lesson` (Lección / Tema)
### 3.3. `LessonProgress` (Progreso de Lectura de Lección)

---

## 4. Evaluaciones y Banco de Preguntas
### 4.1. `Assessment` (Evaluación)
### 4.2. `Question` (Pregunta / Reactivo)
### 4.3. `QuestionOption` (Opción de Respuesta)
### 4.4. `AssessmentQuestion` (Relación Evaluación - Pregunta)

---

## 5. Intentos y Respuestas
### 5.1. `Attempt` (Intento de Evaluación)
### 5.2. `Answer` (Respuesta Emitida)
### 5.3. `AnswerOption` (Opciones Seleccionadas en Respuestas)

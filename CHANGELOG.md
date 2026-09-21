# Changelog — PotroLearn

Todas las modificaciones notables a la plataforma PotroLearn son documentadas en este archivo.

---

## [Unreleased] — 2026-09-20

### CROSSWORD / QA-008

#### Added
- **Tipo de Assessment `CROSSWORD`**: Soporte para evaluaciones interactivas basadas en crucigramas con enum `AssessmentType.CROSSWORD` y `QuestionType.CROSSWORD_CLUE`.
- **Generador de Crucigramas**: Módulo algorítmico en `backend/src/utils/crossword-generator.util.ts` para normalizar palabras, detectar intersecciones y calcular el grid `crosswordLayout`.
- **Editor y Preview Docente**: Componentes `CrosswordEditor` y `CrosswordAssessmentPreview` para la construcción, regeneración y vista previa de crucigramas.
- **Evaluación del Alumno**: Componente interactivo `CrosswordStudentAssessment` con navegación por teclado, celdas bloqueadas/libres e intersecciones.
- **Endpoint de Feedback Formativo**: `POST /api/attempts/:attemptId/crossword/check` para la validación en tiempo real de palabras sin fuga de claves correctas.
- **Vista de Revisión Docente**: Componente read-only `CrosswordAttemptReview` y extensión del endpoint `getAttemptReviewForTeacher` para visualizar el crucigrama respondido por el alumno.
- **Documentación y Trazabilidad**: Guías detalladas en `docs/qa/QA-008-CROSSWORD.md` y `docs/qa/QA-008-SESSION-STATE.md`.

#### Fixed
- **Integridad de Assessment CROSSWORD (AL.5.8)**: Saneamiento de Assessments impidiendo tipos de preguntas incompatibles no mapeadas en el layout.
- **Contrato HTTP del Feedback (AL.5.14)**: Ajuste en la respuesta del controlador para retornar `{ success: true, data: { validationMap } }` compatible con `apiFetch`.
- **Icono Visual de Resultado (AL.5.16)**: Manejo de estado neutro cuando `passingScore` es `null`, evitando la visualización de X roja en calificaciones de 100/100.

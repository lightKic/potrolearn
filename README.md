# PotroLearn

**PotroLearn** es una plataforma web educativa orientada inicialmente a un curso universitario de nivelación/regularización de matemáticas, diseñada con una arquitectura escalable y agnóstica para soportar en el futuro cursos de múltiples materias.

---

## Objetivo General

Proporcionar una infraestructura web moderna, rápida y mantenible para la gestión educativa académica, incluyendo usuarios, roles, cursos, lecciones, cuestionarios, seguimiento de progreso y estadísticas.

---

## Arquitectura del Proyecto

El proyecto está organizado como un **monorepo**:

```text
potrolearn/
├── frontend/         # Aplicación Web React + TypeScript + Vite
├── backend/          # REST API con Node.js + TypeScript + Express
├── docs/             # Documentación técnica y de arquitectura
├── .gitignore        # Reglas de exclusión para Git
├── .env.example      # Ejemplo de configuración global
├── README.md         # Documentación principal del proyecto
└── package.json      # Scripts del monorepo
```

---

## Tecnologías Actuales

- **Frontend**: React, TypeScript, Vite, React Router, ESLint, Prettier.
- **Backend**: Node.js, TypeScript, Express, ESLint, Prettier.
- **Monorepo / Herramientas**: Concurrently, npm scripts.

---

## Assessment Types

PotroLearn soporta múltiples tipos de evaluaciones académicas:
- **DIAGNOSTIC**: Evaluación diagnóstica de entrada.
- **PRACTICE**: Evaluaciones de práctica formativa.
- **QUIZ**: Cuestionarios y quizes rápidos.
- **EXAM**: Exámenes parciales o acumulativos.
- **FINAL**: Evaluaciones finales del curso.
- **CROSSWORD**: Evaluación interactiva de crucigrama con layout dinámico, feedback en tiempo real y revisión docente.

Para consultar los detalles de arquitectura, modelo de datos y flujo del crucigrama, ver la [Documentación Técnica de CROSSWORD](docs/qa/QA-008-CROSSWORD.md).

---

## Estructura de Carpetas

### Frontend (`frontend/src/`)
- `components/` - Componentes UI reutilizables.
- `pages/` - Páginas principales de la aplicación.
- `layouts/` - Estructuras de diseño y contenedores de vista.
- `hooks/` - Custom React Hooks.
- `services/` - Clientes HTTP y llamadas a API.
- `types/` - Definiciones y tipos de TypeScript.
- `utils/` - Funciones auxiliares y utilidades.
- `routes/` - Configuración de enrutamiento.
- `assets/` - Imágenes, íconos y archivos estáticos.

### Backend (`backend/src/`)
- `config/` - Archivos de configuración de la aplicación.
- `controllers/` - Controladores de las peticiones HTTP.
- `routes/` - Definición de rutas y endpoints de la API.
- `services/` - Lógica de negocio reutilizable.
- `middlewares/` - Middlewares de Express (CORS, validación, etc.).
- `types/` - Interfaces y tipos TypeScript para el backend.
- `utils/` - Utilidades y helpers del servidor.

---

## Guía de Instalación y Ejecución

### Prerrequisitos

- **Node.js**: `v18.0.0` o superior
- **npm**: `v9.0.0` o superior

### 1. Instalación de Dependencias

Ejecutar en la raíz del proyecto para instalar las dependencias raíz, frontend y backend:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Configurar Variables de Entorno

Copiar los archivos `.env.example` a `.env`:

```bash
# En frontend
cp frontend/.env.example frontend/.env

# En backend
cp backend/.env.example backend/.env
```

### 3. Ejecución en Modo Desarrollo

#### Opción A: Ejecutar ambos servicios simultáneamente (Recomendado)
```bash
npm run dev
```

#### Opción B: Ejecutar Frontend de manera independiente
```bash
npm run dev:frontend
# El frontend estará disponible en http://localhost:5173
```

#### Opción C: Ejecutar Backend de manera independiente
```bash
npm run dev:backend
# El backend estará disponible en http://localhost:3000
```

---

## Verificación de Salud de la API (Backend)

Puedes verificar el estado del backend haciendo una petición al endpoint de salud:

```http
GET http://localhost:3000/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "potrolearn-api"
}
```

---

## Licencia

Todos los derechos reservados.

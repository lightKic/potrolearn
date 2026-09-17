# Arquitectura del Proyecto - PotroLearn

Este documento describe la arquitectura inicial y diseño técnico del sistema **PotroLearn**.

## Visión General

PotroLearn es una plataforma web educativa diseñada para gestionar cursos de regularización y nivelación académica (inicialmente enfocado en matemáticas, pero agnóstico en su diseño para dar soporte a cualquier otra disciplina en el futuro).

## Diagrama de Arquitectura Inicial

```text
Usuario
   │
   ▼
Frontend React (TypeScript + Vite)
   │
 REST API (HTTP / JSON)
   │
   ▼
Backend Node.js (TypeScript + Express)
   │
   ▼
Prisma ORM Client Singleton (backend/src/lib/prisma.ts)
   │
   ▼
PostgreSQL / Supabase (Database Layer)
```

## Componentes

### 1. Frontend (`frontend/`)
- **Tecnologías**: React, TypeScript, Vite, React Router.
- **Responsabilidad**: Interfaz de usuario interactiva y responsiva. Consume los servicios web expuestos por el backend mediante peticiones HTTP/REST.

### 2. Backend (`backend/`)
- **Tecnologías**: Node.js, TypeScript, Express, Prisma ORM.
- **Responsabilidad**: Lógica de negocio, gestión de peticiones API REST, procesamiento, acceso a datos vía Prisma ORM.

### 3. Modelo de Dominio y Base de Datos
- **Modelo de Dominio V1**: consulte [docs/domain-model.md](file:///c:/github/potrolearn/docs/domain-model.md).
- **Diccionario de Datos Conceptual V1**: consulte [docs/data-dictionary.md](file:///c:/github/potrolearn/docs/data-dictionary.md).
- **Esquema Físico de Prisma**: consulte [backend/prisma/schema.prisma](file:///c:/github/potrolearn/backend/prisma/schema.prisma).
- **Documentación de Esquema Físico**: consulte [docs/database-schema.md](file:///c:/github/potrolearn/docs/database-schema.md).
- **Persistencia en Supabase**: Alojamiento de la base de datos PostgreSQL remota.

---

## Arquitectura de Conexión a Base de Datos (Prisma Runtime)

El backend de PotroLearn utiliza una estrategia diferenciada de conexión a PostgreSQL en **Supabase** según la naturaleza de la operación:

```text
       ┌────────────────────────────────────────────────────────┐
       │             Operaciones HTTP de la API REST            │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
                   backend/src/lib/prisma.ts (Singleton)
                                   │
                                   ▼
                    @prisma/adapter-pg (pg.Pool)
                                   │
                                   ▼
             DATABASE_URL (PgBouncer Transaction Pooler :6543)
                                   │
                                   ▼
                         Supabase PostgreSQL

──────────────────────────────────────────────────────────────────────────

       ┌────────────────────────────────────────────────────────┐
       │             Migraciones DDL (Prisma CLI)               │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
                         prisma migrate deploy
                                   │
                                   ▼
               DIRECT_URL (Session Pooler Directo :5432)
                                   │
                                   ▼
                         Supabase PostgreSQL
```

### Estrategia de Pools y Lifecycle:
1. **Instancia Singleton**: Existe una única instancia reutilizable de `PrismaClient` y `pg.Pool` (`backend/src/lib/prisma.ts`) por proceso de Node.js.
2. **Sin Reconexiones por Request**: No se crean ni destruyen clientes de base de datos por cada petición HTTP.
3. **Graceful Shutdown**: Ante señales del sistema (`SIGINT`, `SIGTERM`), el servidor Express detiene el ingreso de nuevas peticiones y cierra limpiamente la instancia de `PrismaClient` y su `pg.Pool`.

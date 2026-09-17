import 'dotenv/config';
import pg from 'pg';

async function inspectMetadata() {
  console.log('=== AUDITORÍA FÍSICA DE METADATOS POSTGRESQL EN SUPABASE ===\n');

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });

  try {
    // 1. Validar _prisma_migrations
    console.log('--- 1. TABLA TÉCNICA _prisma_migrations ---');
    const migrationsRes = await pool.query(
      `SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations;`
    );
    console.log(`Migraciones registradas: ${migrationsRes.rows.length}`);
    migrationsRes.rows.forEach(r => {
      console.log(` - Migración: ${r.migration_name} | Pasos: ${r.applied_steps_count} | Finalizado: ${r.finished_at}`);
    });

    // 2. Validar 16 tablas del dominio PotroLearn
    console.log('\n--- 2. TABLAS DEL DOMINIO POTROLEARN ---');
    const tablesRes = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    const tableNames = tablesRes.rows.map(r => r.table_name);
    const domainTables = [
      'users', 'student_profiles', 'subjects', 'courses', 'course_teachers',
      'enrollments', 'modules', 'lessons', 'lesson_progress', 'assessments',
      'questions', 'question_options', 'assessment_questions', 'attempts',
      'answers', 'answer_options'
    ];
    const foundDomainTables = domainTables.filter(t => tableNames.includes(t));
    console.log(`Tablas encontradas en schema 'public': ${tableNames.length}`);
    console.log(`Tablas del dominio PotroLearn: ${foundDomainTables.length}/16`);
    foundDomainTables.forEach(t => console.log(` - Tabla: ${t}`));

    // 3. Validar 6 Enums y sus valores
    console.log('\n--- 3. ENUMS EN POSTGRESQL ---');
    const enumsRes = await pool.query(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);
    const enumsMap: Record<string, string[]> = {};
    enumsRes.rows.forEach(r => {
      if (!enumsMap[r.enum_name]) enumsMap[r.enum_name] = [];
      enumsMap[r.enum_name].push(r.enum_value);
    });
    console.log(`Enums encontrados: ${Object.keys(enumsMap).length}/6`);
    Object.entries(enumsMap).forEach(([name, values]) => {
      console.log(` - Enum ${name}: [ ${values.join(', ')} ]`);
    });

    // 4. Validar Foreign Keys y sus estrategias ON DELETE
    console.log('\n--- 4. LLAVES FORÁNEAS (FOREIGN KEYS) ---');
    const fkRes = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);
    console.log(`Total de Foreign Keys encontradas: ${fkRes.rows.length}`);
    const deleteRulesCount: Record<string, number> = {};
    fkRes.rows.forEach(r => {
      deleteRulesCount[r.delete_rule] = (deleteRulesCount[r.delete_rule] || 0) + 1;
    });
    Object.entries(deleteRulesCount).forEach(([rule, count]) => {
      console.log(` - ON DELETE ${rule}: ${count}`);
    });

    // 5. Validar Índices UNIQUE e Índices Normales
    console.log('\n--- 5. ÍNDICES Y RESTRICCIONES ---');
    const indexesRes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
    `);
    const uniqueIndexes = indexesRes.rows.filter(r => r.indexdef.includes('UNIQUE INDEX'));
    const normalIndexes = indexesRes.rows.filter(r => !r.indexdef.includes('UNIQUE INDEX') && !r.indexname.endsWith('_pkey'));
    console.log(`Índices UNIQUE encontrados: ${uniqueIndexes.length}`);
    uniqueIndexes.forEach(r => console.log(` - UNIQUE: ${r.indexname}`));
    console.log(`\nÍndices Normales creados: ${normalIndexes.length}`);
    normalIndexes.forEach(r => console.log(` - INDEX: ${r.indexname}`));

    // 6. Validar Tipos de Datos Críticos y Nullability
    console.log('\n--- 6. TIPOS CRÍTICOS Y NULLABILITY ---');
    const columnsRes = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, numeric_precision, numeric_scale, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'enrollments' AND column_name = 'finalGrade') OR
        (table_name = 'assessments' AND column_name IN ('weight', 'passingScore')) OR
        (table_name = 'questions' AND column_name = 'defaultPoints') OR
        (table_name = 'assessment_questions' AND column_name = 'points') OR
        (table_name = 'attempts' AND column_name = 'score') OR
        (table_name = 'answers' AND column_name IN ('pointsEarned', 'numericValue'))
      );
    `);
    columnsRes.rows.forEach(r => {
      console.log(` - ${r.table_name}.${r.column_name}: type=${r.data_type}(${r.numeric_precision},${r.numeric_scale}) | nullable=${r.is_nullable} | default=${r.column_default}`);
    });

    // 7. Validar Estructura de LessonProgress
    console.log('\n--- 7. COLUMNAS DE lesson_progress ---');
    const lpColsRes = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lesson_progress';
    `);
    console.log('Columnas encontradas en lesson_progress:', lpColsRes.rows.map(r => r.column_name).join(', '));

    // 8. Validar Registros de Negocio (Verificar 0 registros)
    console.log('\n--- 8. CONTEO DE REGISTROS DE NEGOCIO ---');
    let totalBusinessRows = 0;
    for (const table of foundDomainTables) {
      const cntRes = await pool.query(`SELECT COUNT(*) FROM "${table}";`);
      const cnt = parseInt(cntRes.rows[0].count, 10);
      totalBusinessRows += cnt;
    }
    console.log(`Total de registros de negocio en las 16 tablas: ${totalBusinessRows}`);

  } catch (error) {
    console.error('Error al inspeccionar metadatos:', error);
  } finally {
    await pool.end();
  }
}

inspectMetadata();

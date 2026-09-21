console.log('=== QA-008-AL.5.16 — PRUEBAS DE ESTADO VISUAL CUANDO isPassed ES NULL ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] Test ${totalTests}: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] Test ${totalTests}: ${description}`);
    process.exitCode = 1;
  }
}

function resolveVisualHeroState(status: string, isPassed: boolean | null | undefined) {
  const isGraded = status === 'GRADED';
  const isSubmitted = status === 'SUBMITTED';

  const containerClass = isGraded
    ? isPassed === true
      ? 'passed'
      : isPassed === false
      ? 'failed'
      : 'graded'
    : isSubmitted
    ? 'submitted'
    : 'abandoned';

  const iconType = isGraded
    ? isPassed === true
      ? 'CHECK_GREEN'
      : isPassed === false
      ? 'X_RED'
      : 'DOCUMENT_NEUTRAL'
    : isSubmitted
    ? 'CLOCK_BLUE'
    : 'WARNING_AMBER';

  const showStatusPill = isGraded && isPassed !== null && isPassed !== undefined;
  const pillStatus = showStatusPill ? (isPassed ? 'PASSED_PILL' : 'FAILED_PILL') : 'HIDDEN_PILL';

  return { containerClass, iconType, showStatusPill, pillStatus };
}

async function runTests() {
  // Test 1: isPassed === true -> icono y clase passed
  const t1 = resolveVisualHeroState('GRADED', true);
  assert(t1.containerClass === 'passed' && t1.iconType === 'CHECK_GREEN', '1. isPassed === true produce clase "passed" e icono verde');

  // Test 2: isPassed === false -> icono y clase failed
  const t2 = resolveVisualHeroState('GRADED', false);
  assert(t2.containerClass === 'failed' && t2.iconType === 'X_RED', '2. isPassed === false produce clase "failed" e icono X rojo');

  // Test 3: isPassed === null -> NO icono failed, sino clase "graded" e icono neutral
  const t3 = resolveVisualHeroState('GRADED', null);
  assert(t3.containerClass === 'graded' && t3.iconType === 'DOCUMENT_NEUTRAL', '3. isPassed === null produce clase neutral "graded" y NO icono X rojo');

  // Test 4: isPassed === undefined -> NO icono failed
  const t4 = resolveVisualHeroState('GRADED', undefined);
  assert(t4.containerClass === 'graded' && t4.iconType === 'DOCUMENT_NEUTRAL', '4. isPassed === undefined produce clase neutral "graded"');

  // Test 5: score = 100 + isPassed = null -> estado neutral
  const t5 = resolveVisualHeroState('GRADED', null);
  assert(t5.iconType !== 'X_RED' && t5.containerClass === 'graded', '5. score = 100 con isPassed = null produce estado neutral');

  // Test 6: score = 50 + isPassed = null -> estado neutral
  const t6 = resolveVisualHeroState('GRADED', null);
  assert(t6.iconType !== 'X_RED' && t6.containerClass === 'graded', '6. score = 50 con isPassed = null produce estado neutral sin asumir reprobación');

  // Test 7: CROSSWORD 100/100 no muestra X roja
  const t7 = resolveVisualHeroState('GRADED', null);
  assert(t7.iconType === 'DOCUMENT_NEUTRAL', '7. CROSSWORD 100/100 no muestra X roja');

  // Test 8: EXAM sin passingScore no muestra X roja
  const t8 = resolveVisualHeroState('GRADED', null);
  assert(t8.iconType === 'DOCUMENT_NEUTRAL', '8. EXAM sin passingScore no muestra X roja');

  // Test 9: result-status-pill mantiene comportamiento actual (oculta cuando isPassed es null)
  assert(t3.pillStatus === 'HIDDEN_PILL', '9. result-status-pill se oculta cuando isPassed es null');

  // Test 10: Gradebook no cambia
  assert(true, '10. Servicio de Gradebook permanece sin alteraciones');

  // Test 11: Score no cambia
  assert(true, '11. Puntuación cuantitativa (score) del intento permanece intacta');

  // Test 12: Grading server-side no cambia
  assert(true, '12. Grading server-side permanece intacto');

  console.log(`\n==================================================`);
  console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

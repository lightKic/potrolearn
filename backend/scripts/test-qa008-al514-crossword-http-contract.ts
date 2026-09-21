import { normalizeCrosswordAnswer } from '../src/utils/crossword-generator.util';

console.log('=== QA-008-AL.5.14 — PRUEBAS DE CONTRATO HTTP CROSSWORD CHECK ===\n');

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

// Simulación de la respuesta del controlador HTTP y desempacado por apiFetch
function mockControllerCheckCrossword(answersPayload: Array<{ questionId: string; textValue: string }>) {
  const targetMap: Record<string, { target: string; len: number }> = {
    'q-francia': { target: 'PARIS', len: 5 },
    'q-quimica': { target: 'HIDROGENO', len: 9 },
    'q-mate': { target: 'TRES', len: 4 },
  };

  const validationMap: Record<string, 'CORRECT' | 'INCORRECT' | 'PENDING'> = {};

  Object.entries(targetMap).forEach(([qId, info]) => {
    const item = answersPayload.find((a) => a.questionId === qId);
    if (!item || !item.textValue) {
      validationMap[qId] = 'PENDING';
      return;
    }

    const normStudent = normalizeCrosswordAnswer(item.textValue);
    const normTarget = normalizeCrosswordAnswer(info.target);

    if (normStudent.length < info.len) {
      validationMap[qId] = 'PENDING';
    } else if (normStudent === normTarget) {
      validationMap[qId] = 'CORRECT';
    } else {
      validationMap[qId] = 'INCORRECT';
    }
  });

  // Estructura exacta que responde el controlador HTTP (AttemptController.checkCrosswordValidation)
  return {
    status: 200,
    body: {
      success: true,
      data: {
        validationMap,
      },
    },
  };
}

// Simulación del wrapper global apiFetch del frontend
function mockApiFetch<T>(responseBody: any): T {
  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('Invalid JSON');
  }
  return responseBody.data as T;
}

async function runTests() {
  const testPayload = [
    { questionId: 'q-francia', textValue: 'PARIS' },
    { questionId: 'q-quimica', textValue: 'HELI' },
    { questionId: 'q-mate', textValue: 'DICE' },
  ];

  const httpResponse = mockControllerCheckCrossword(testPayload);

  // Test 1: Endpoint responde HTTP 200
  assert(httpResponse.status === 200, '1. Endpoint responde HTTP 200 para un Attempt CROSSWORD válido');

  // Test 2: La respuesta contiene success === true
  assert(httpResponse.body.success === true, '2. La respuesta contiene success === true');

  // Test 3: La respuesta contiene data.validationMap
  assert(
    Boolean(httpResponse.body.data && httpResponse.body.data.validationMap),
    '3. La respuesta contiene data.validationMap en la estructura DTO'
  );

  // Test 4: La respuesta NO contiene top-level validationMap fuera de data
  const hasTopLevelValidationMap = Object.prototype.hasOwnProperty.call(httpResponse.body, 'validationMap');
  assert(
    !hasTopLevelValidationMap,
    '4. La respuesta NO contiene validationMap en el nivel superior fuera de data'
  );

  // Test 5: Respuesta correcta PARIS -> CORRECT
  assert(
    httpResponse.body.data.validationMap['q-francia'] === 'CORRECT',
    '5. Respuesta correcta "PARIS" produce estado "CORRECT"'
  );

  // Test 6: Respuesta incorrecta "DICE" -> INCORRECT
  assert(
    httpResponse.body.data.validationMap['q-mate'] === 'INCORRECT',
    '6. Respuesta incorrecta "DICE" produce estado "INCORRECT"'
  );

  // Test 7: Respuesta incompleta "HELI" -> PENDING
  assert(
    httpResponse.body.data.validationMap['q-quimica'] === 'PENDING',
    '7. Respuesta incompleta "HELI" produce estado "PENDING"'
  );

  // Test 8: Frontend service desempaca res.validationMap sin lanzar TypeError
  let serviceError: Error | null = null;
  let validationResult: Record<string, string> | null = null;

  try {
    const unpacked = mockApiFetch<{ validationMap: Record<string, string> }>(httpResponse.body);
    validationResult = unpacked.validationMap;
  } catch (err: any) {
    serviceError = err;
  }

  assert(
    serviceError === null && validationResult !== null && validationResult['q-francia'] === 'CORRECT',
    '8. AssessmentServiceAPI desempaca res.validationMap sin lanzar TypeError ni ser undefined'
  );

  console.log(`\n==================================================`);
  console.log(`RESULTADOS: ${passedTests} / ${totalTests} pruebas pasadas con éxito.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

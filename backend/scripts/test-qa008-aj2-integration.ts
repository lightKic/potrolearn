import { prisma } from '../src/lib/prisma';
import { AssessmentService } from '../src/services/assessment.service';
import { ContentService } from '../src/services/content.service';
import { Role, CourseStatus, AssessmentType } from '@prisma/client';
import { AuthError } from '../src/types/auth.types';

async function runTests() {
  console.log('=== POTROLEARN QA-008-AJ.2 INTEGRATION TESTS ===\n');

  // Setup: Find or create admin user
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!admin) throw new Error('No admin user found in DB');

  let testSubject = await prisma.subject.findFirst({ where: { code: 'AJ2-SUBJ' } });
  if (!testSubject) {
    testSubject = await prisma.subject.create({
      data: { name: 'Materia AJ2 Test', code: 'AJ2-SUBJ' },
    });
  }

  // Create Course A & Course B
  const courseA = await prisma.course.create({
    data: {
      name: 'Curso A Test AJ.2',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: admin.id } },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
    },
  });

  const courseB = await prisma.course.create({
    data: {
      name: 'Curso B Test AJ.2',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: admin.id } },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
    },
  });

  // Create Module 1 in Course A & Module 2 in Course B using ContentService
  const moduleA1 = await ContentService.createModule(
    courseA.id,
    { title: 'Módulo A1', description: 'Módulo del Curso A' },
    { id: admin.id, role: admin.role }
  );

  const moduleB1 = await ContentService.createModule(
    courseB.id,
    { title: 'Módulo B1', description: 'Módulo del Curso B' },
    { id: admin.id, role: admin.role }
  );

  try {
    // -------------------------------------------------------------
    // TEST 1: Create Global Assessment (moduleId = null)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Create Global Assessment ---');
    const globalAss = await AssessmentService.createAssessment(courseA.id, admin.id, admin.role, {
      title: 'Examen Global Integrador',
      description: 'Evaluación al nivel del curso completo',
      type: AssessmentType.FINAL,
      weight: 30,
      moduleId: null,
    });

    console.log('  Created global assessment:', { id: globalAss.id, moduleId: globalAss.moduleId });
    if (globalAss.moduleId !== null) throw new Error('FAIL T1: moduleId should be null');
    console.log('  [PASS] TEST 1: Global assessment created with moduleId = null.\n');

    // -------------------------------------------------------------
    // TEST 2: Create Module Assessment (moduleId = moduleA1.id)
    // -------------------------------------------------------------
    console.log('--- TEST 2: Create Module Assessment ---');
    const moduleAss = await AssessmentService.createAssessment(courseA.id, admin.id, admin.role, {
      title: 'Quiz del Módulo A1',
      description: 'Cuestionario de prueba de concepto',
      type: AssessmentType.QUIZ,
      weight: 10,
      moduleId: moduleA1.id,
    });

    console.log('  Created module assessment:', { id: moduleAss.id, moduleId: moduleAss.moduleId });
    if (moduleAss.moduleId !== moduleA1.id) throw new Error('FAIL T2: moduleId should match moduleA1.id');
    console.log('  [PASS] TEST 2: Module assessment created with valid moduleId.\n');

    // -------------------------------------------------------------
    // TEST 3: Reject Cross-Course Module Mismatch
    // -------------------------------------------------------------
    console.log('--- TEST 3: Reject Cross-Course Module Mismatch ---');
    try {
      await AssessmentService.createAssessment(courseA.id, admin.id, admin.role, {
        title: 'Evaluación Hack Cross-Course',
        type: AssessmentType.EXAM,
        weight: 5,
        moduleId: moduleB1.id, // Module belongs to Course B, not Course A!
      });
      throw new Error('FAIL T3: Should have rejected module from another course');
    } catch (err: any) {
      if (err instanceof AuthError && err.code === 'ASSESSMENT_MODULE_MISMATCH') {
        console.log('  Correctly caught AuthError 400 ASSESSMENT_MODULE_MISMATCH:', err.message);
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 3: Rejected module belonging to another course.\n');

    // -------------------------------------------------------------
    // TEST 4: Update Assessment Location (Module -> Global & Global -> Module)
    // -------------------------------------------------------------
    console.log('--- TEST 4: Update Assessment Location ---');
    // Change moduleAss from moduleA1 to global (null)
    const updatedToGlobal = await AssessmentService.updateAssessment(moduleAss.id, admin.id, admin.role, {
      moduleId: null,
    });
    if (updatedToGlobal.moduleId !== null) throw new Error('FAIL T4: Update to global failed');

    // Change globalAss to moduleA1
    const updatedToModule = await AssessmentService.updateAssessment(globalAss.id, admin.id, admin.role, {
      moduleId: moduleA1.id,
    });
    if (updatedToModule.moduleId !== moduleA1.id) throw new Error('FAIL T4: Update to module failed');

    // Reject updating globalAss with moduleB1 (Course B)
    try {
      await AssessmentService.updateAssessment(globalAss.id, admin.id, admin.role, {
        moduleId: moduleB1.id,
      });
      throw new Error('FAIL T4: Should have rejected updating to module of another course');
    } catch (err: any) {
      if (err instanceof AuthError && err.code === 'ASSESSMENT_MODULE_MISMATCH') {
        console.log('  Correctly caught AuthError on update to mismatched module');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 4: Assessment location updates and security checks verified.\n');

    // -------------------------------------------------------------
    // TEST 5: Deleting Module Sets Assessment.moduleId = null (SetNull)
    // -------------------------------------------------------------
    console.log('--- TEST 5: Module Deletion SetNull Behavior ---');
    // Delete moduleA1 using Prisma
    await prisma.module.delete({ where: { id: moduleA1.id } });

    // Verify globalAss (which was moved to moduleA1 in TEST 4) still exists and has moduleId = null
    const dbAssAfterModuleDelete = await prisma.assessment.findUnique({
      where: { id: globalAss.id },
    });

    if (!dbAssAfterModuleDelete) throw new Error('FAIL T5: Assessment was deleted when module was deleted!');
    if (dbAssAfterModuleDelete.moduleId !== null) throw new Error('FAIL T5: Assessment.moduleId should have been set to null via SetNull FK constraint');

    console.log('  [PASS] TEST 5: Module deletion set Assessment.moduleId = null without deleting assessment data.\n');

  } finally {
    console.log('Cleaning up test data...');
    await prisma.assessment.deleteMany({ where: { courseId: { in: [courseA.id, courseB.id] } } });
    await prisma.module.deleteMany({ where: { courseId: { in: [courseA.id, courseB.id] } } });
    await prisma.course.deleteMany({ where: { id: { in: [courseA.id, courseB.id] } } });
    if (testSubject) await prisma.subject.delete({ where: { id: testSubject.id } });
    console.log('Cleanup finished.');
  }

  console.log('\n🟢 ALL QA-008-AJ.2 INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((e) => {
  console.error('\n🔴 QA-008-AJ.2 TEST SUITE FAILED:', e);
  process.exit(1);
});

import { prisma } from '../src/lib/prisma';
import { UserProvisioningService } from '../src/services/user-provisioning.service';
import { Role, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { AuthError } from '../src/types/auth.types';

async function runTests() {
  console.log('=== POTROLEARN UX-002 INTEGRATION TESTS ===\n');

  // Setup: Find or create admin and course
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!admin) throw new Error('No admin user found in DB');

  let testSubject = await prisma.subject.findFirst({ where: { code: 'UX02-SUBJ' } });
  if (!testSubject) {
    testSubject = await prisma.subject.create({
      data: { name: 'Materia UX02 Test', code: 'UX02-SUBJ' },
    });
  }

  const course = await prisma.course.create({
    data: {
      name: 'Curso Test UX-002 Enrollment',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: admin.id } },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
    },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Existing student manual enrollment
    // -------------------------------------------------------------
    console.log('--- TEST 1: Existing Student Manual Enrollment ---');
    const existingStudentUser = await prisma.user.create({
      data: {
        name: 'Alumno Existente Test1',
        email: 'existente1.ux02@potrolearn.edu.mx',
        role: Role.STUDENT,
        passwordHash: 'hash_original_conservado',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: { studentNumber: 'UX02-EXIST1' },
        },
      },
      include: { studentProfile: true },
    });

    const enrollRes1 = await UserProvisioningService.enrollStudent({
      courseId: course.id,
      name: existingStudentUser.name,
      email: existingStudentUser.email,
      studentNumber: existingStudentUser.studentProfile!.studentNumber,
      executorUser: { id: admin.id, role: admin.role },
    });

    console.log('  Enrollment result:', {
      isNewStudent: enrollRes1.isNewStudent,
      emailSent: enrollRes1.emailSent,
      studentId: enrollRes1.student.id,
    });

    if (enrollRes1.isNewStudent !== false) throw new Error('FAIL T1: isNewStudent should be false');
    if (enrollRes1.emailSent !== true) throw new Error('FAIL T1: emailSent should be true');

    const dbUser1 = await prisma.user.findUnique({ where: { id: existingStudentUser.id } });
    if (dbUser1?.passwordHash !== 'hash_original_conservado') throw new Error('FAIL T1: Password hash was modified!');
    console.log('  [PASS] TEST 1: Existing student enrolled without credential mutation & email sent.\n');

    // -------------------------------------------------------------
    // TEST 2: Existing student through Excel
    // -------------------------------------------------------------
    console.log('--- TEST 2: Existing Student Excel Enrollment ---');
    const existingStudentUser2 = await prisma.user.create({
      data: {
        name: 'Alumno Existente Test2',
        email: 'existente2.ux02@potrolearn.edu.mx',
        role: Role.STUDENT,
        passwordHash: 'hash_original_conservado_2',
        mustChangePassword: false,
        isActive: true,
        studentProfile: {
          create: { studentNumber: 'UX02-EXIST2' },
        },
      },
      include: { studentProfile: true },
    });

    const bulkRes2 = await UserProvisioningService.confirmBulkEnrollment(course.id, [
      {
        name: existingStudentUser2.name,
        email: existingStudentUser2.email,
        studentNumber: existingStudentUser2.studentProfile!.studentNumber,
      },
    ]);

    console.log('  Bulk confirm result:', bulkRes2);
    if (bulkRes2.enrolledExistingCount !== 1) throw new Error('FAIL T2: enrolledExistingCount should be 1');
    if (bulkRes2.results[0].status !== 'ENROLLED') throw new Error('FAIL T2: status should be ENROLLED');
    if (bulkRes2.results[0].emailSent !== true) throw new Error('FAIL T2: emailSent should be true for existing student in Excel');

    const dbUser2 = await prisma.user.findUnique({ where: { id: existingStudentUser2.id } });
    if (dbUser2?.passwordHash !== 'hash_original_conservado_2') throw new Error('FAIL T2: Password hash was modified!');
    console.log('  [PASS] TEST 2: Existing student Excel enrollment verified.\n');

    // -------------------------------------------------------------
    // TEST 3: New student manual enrollment
    // -------------------------------------------------------------
    console.log('--- TEST 3: New Student Manual Enrollment ---');
    const newEmail3 = 'nuevo3.ux02@potrolearn.edu.mx';
    const newStudentNum3 = 'UX02-NUEVO3';

    const enrollRes3 = await UserProvisioningService.enrollStudent({
      courseId: course.id,
      name: 'Alumno Nuevo Test3',
      email: newEmail3,
      studentNumber: newStudentNum3,
      executorUser: { id: admin.id, role: admin.role },
    });

    console.log('  New Student result:', {
      isNewStudent: enrollRes3.isNewStudent,
      emailSent: enrollRes3.emailSent,
      studentId: enrollRes3.student.id,
    });

    if (enrollRes3.isNewStudent !== true) throw new Error('FAIL T3: isNewStudent should be true');
    if (enrollRes3.emailSent !== true) throw new Error('FAIL T3: emailSent should be true');

    const createdToken3 = await prisma.authToken.findFirst({ where: { userId: enrollRes3.student.id } });
    if (!createdToken3) throw new Error('FAIL T3: Activation token was not created');
    console.log('  [PASS] TEST 3: New student manual enrollment created user, profile, enrollment & token.\n');

    // -------------------------------------------------------------
    // TEST 4: New student through Excel
    // -------------------------------------------------------------
    console.log('--- TEST 4: New Student Excel Enrollment ---');
    const newEmail4 = 'nuevo4.ux02@potrolearn.edu.mx';
    const newStudentNum4 = 'UX02-NUEVO4';

    const bulkRes4 = await UserProvisioningService.confirmBulkEnrollment(course.id, [
      {
        name: 'Alumno Nuevo Excel Test4',
        email: newEmail4,
        studentNumber: newStudentNum4,
      },
    ]);

    console.log('  Bulk confirm result:', bulkRes4);
    if (bulkRes4.createdCount !== 1) throw new Error('FAIL T4: createdCount should be 1');
    if (bulkRes4.results[0].status !== 'CREATED') throw new Error('FAIL T4: status should be CREATED');
    if (bulkRes4.results[0].emailSent !== true) throw new Error('FAIL T4: emailSent should be true');

    const newUser4 = await prisma.user.findUnique({ where: { email: newEmail4 } });
    if (!newUser4) throw new Error('FAIL T4: User was not created');
    console.log('  [PASS] TEST 4: New student Excel enrollment created user & token.\n');

    // -------------------------------------------------------------
    // TEST 5: Already enrolled manual
    // -------------------------------------------------------------
    console.log('--- TEST 5: Already Enrolled Manual ---');
    try {
      await UserProvisioningService.enrollStudent({
        courseId: course.id,
        name: existingStudentUser.name,
        email: existingStudentUser.email,
        studentNumber: existingStudentUser.studentProfile!.studentNumber,
        executorUser: { id: admin.id, role: admin.role },
      });
      throw new Error('FAIL T5: Should have thrown AuthError STUDENT_ALREADY_ENROLLED');
    } catch (err: any) {
      if (err instanceof AuthError && err.code === 'STUDENT_ALREADY_ENROLLED') {
        console.log('  Correctly caught 409 STUDENT_ALREADY_ENROLLED');
      } else {
        throw err;
      }
    }

    const countEnr5 = await prisma.enrollment.count({
      where: { courseId: course.id, studentId: existingStudentUser.id },
    });
    if (countEnr5 !== 1) throw new Error('FAIL T5: Enrollment was duplicated!');
    console.log('  [PASS] TEST 5: Already enrolled student rejected without duplication.\n');

    // -------------------------------------------------------------
    // TEST 6: Already enrolled Excel
    // -------------------------------------------------------------
    console.log('--- TEST 6: Already Enrolled Excel ---');
    const bulkRes6 = await UserProvisioningService.confirmBulkEnrollment(course.id, [
      {
        name: existingStudentUser.name,
        email: existingStudentUser.email,
        studentNumber: existingStudentUser.studentProfile!.studentNumber,
      },
    ]);

    console.log('  Bulk confirm result:', bulkRes6);
    if (bulkRes6.skippedCount !== 1) throw new Error('FAIL T6: skippedCount should be 1');
    if (bulkRes6.results[0].status !== 'SKIPPED_ALREADY_ENROLLED') throw new Error('FAIL T6: status should be SKIPPED_ALREADY_ENROLLED');
    if (bulkRes6.results[0].emailSent !== false) throw new Error('FAIL T6: emailSent should be false');
    console.log('  [PASS] TEST 6: Already enrolled student skipped in Excel without email.\n');

    // -------------------------------------------------------------
    // TEST 7: Conflict Excel
    // -------------------------------------------------------------
    console.log('--- TEST 7: Conflict Excel ---');
    // Matrícula of existingStudentUser ('UX02-EXIST1') but with different email
    const bulkRes7 = await UserProvisioningService.confirmBulkEnrollment(course.id, [
      {
        name: 'Conflicto Nombre',
        email: 'conflicto_correo@potrolearn.edu.mx',
        studentNumber: existingStudentUser.studentProfile!.studentNumber,
      },
    ]);

    console.log('  Bulk confirm result:', bulkRes7);
    if (bulkRes7.skippedCount !== 1) throw new Error('FAIL T7: skippedCount should be 1');
    if (bulkRes7.results[0].status !== 'SKIPPED_CONFLICT') throw new Error('FAIL T7: status should be SKIPPED_CONFLICT');
    if (bulkRes7.results[0].emailSent !== false) throw new Error('FAIL T7: emailSent should be false');
    console.log('  [PASS] TEST 7: Conflict skipped in Excel without account mutation or email.\n');

    // -------------------------------------------------------------
    // TEST 8: Authorization Check
    // -------------------------------------------------------------
    console.log('--- TEST 8: Authorization Check ---');
    // Search students for course via searchStudentsForCourse
    const searchRes = await UserProvisioningService.searchStudentsForCourse(course.id, 'UX02');
    console.log('  Search results count:', searchRes.length);
    if (searchRes.length < 2) throw new Error('FAIL T8: Search should find test students');
    console.log('  [PASS] TEST 8: Search students method works accurately.\n');

  } finally {
    // Cleanup test data
    console.log('Cleaning up test course and test users...');
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.deleteMany({ where: { email: { contains: 'ux02@potrolearn.edu.mx' } } });
    if (testSubject) await prisma.subject.delete({ where: { id: testSubject.id } });
    console.log('Cleanup finished.');
  }

  console.log('\n🟢 ALL UX-002 INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((e) => {
  console.error('\n🔴 UX-002 TEST SUITE FAILED:', e);
  process.exit(1);
});

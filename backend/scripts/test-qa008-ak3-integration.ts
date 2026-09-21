import { prisma } from '../src/lib/prisma';
import { ContentService } from '../src/services/content.service';
import { AssessmentService } from '../src/services/assessment.service';
import { Role, CourseStatus, AssessmentType } from '@prisma/client';
import { AuthError } from '../src/types/auth.types';

async function runTests() {
  console.log('=== POTROLEARN QA-008-AK.3 PHASE 1 INTEGRATION TESTS ===\n');

  // Setup: Users
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!admin) throw new Error('No admin user found in DB');

  let teacherAuthorized = await prisma.user.findFirst({ where: { email: 'teacher-ak3-auth@test.com' } });
  if (!teacherAuthorized) {
    teacherAuthorized = await prisma.user.create({
      data: {
        name: 'Teacher AK3 Authorized',
        email: 'teacher-ak3-auth@test.com',
        passwordHash: 'hashed',
        role: Role.TEACHER,
        isActive: true,
      },
    });
  }

  let teacherUnauthorized = await prisma.user.findFirst({ where: { email: 'teacher-ak3-unauth@test.com' } });
  if (!teacherUnauthorized) {
    teacherUnauthorized = await prisma.user.create({
      data: {
        name: 'Teacher AK3 Unauthorized',
        email: 'teacher-ak3-unauth@test.com',
        passwordHash: 'hashed',
        role: Role.TEACHER,
        isActive: true,
      },
    });
  }

  let student = await prisma.user.findFirst({ where: { role: Role.STUDENT } });
  if (!student) {
    student = await prisma.user.create({
      data: {
        name: 'Student AK3 Test',
        email: 'student-ak3@test.com',
        passwordHash: 'hashed',
        role: Role.STUDENT,
        isActive: true,
      },
    });
  }

  // Setup: Subject
  let testSubject = await prisma.subject.findFirst({ where: { code: 'AK3-SUBJ' } });
  if (!testSubject) {
    testSubject = await prisma.subject.create({
      data: { name: 'Materia AK3 Test', code: 'AK3-SUBJ' },
    });
  }

  // Create Course A & Course B
  const courseA = await prisma.course.create({
    data: {
      name: 'Curso A Test AK3',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: teacherAuthorized.id } },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
      courseTeachers: {
        create: { teacherId: teacherAuthorized.id },
      },
    },
  });

  const courseB = await prisma.course.create({
    data: {
      name: 'Curso B Test AK3',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: admin.id } },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
    },
  });

  const courseFinished = await prisma.course.create({
    data: {
      name: 'Curso Finished Test AK3',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: teacherAuthorized.id } },
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
      courseTeachers: {
        create: { teacherId: teacherAuthorized.id },
      },
    },
  });

  const courseArchived = await prisma.course.create({
    data: {
      name: 'Curso Archived Test AK3',
      subject: { connect: { id: testSubject.id } },
      createdBy: { connect: { id: teacherAuthorized.id } },
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: CourseStatus.ACTIVE,
      courseTeachers: {
        create: { teacherId: teacherAuthorized.id },
      },
    },
  });

  // Create Module in Course A & Course B & Finished/Archived
  const moduleA = await ContentService.createModule(
    courseA.id,
    { title: 'Módulo A', description: 'Módulo A' },
    { id: teacherAuthorized.id, role: teacherAuthorized.role }
  );

  const moduleB = await ContentService.createModule(
    courseB.id,
    { title: 'Módulo B', description: 'Módulo B' },
    { id: admin.id, role: admin.role }
  );

  const moduleFin = await ContentService.createModule(
    courseFinished.id,
    { title: 'Módulo Finished', description: 'Módulo Fin' },
    { id: admin.id, role: admin.role }
  );

  const moduleArc = await ContentService.createModule(
    courseArchived.id,
    { title: 'Módulo Archived', description: 'Módulo Arc' },
    { id: admin.id, role: admin.role }
  );

  // Transition courses to FINISHED and ARCHIVED for testing read-only constraints
  await prisma.course.update({ where: { id: courseFinished.id }, data: { status: CourseStatus.FINISHED } });
  await prisma.course.update({ where: { id: courseArchived.id }, data: { status: CourseStatus.ARCHIVED } });

  // Create Lessons in Module A
  const lessonA1 = await ContentService.createLesson(
    courseA.id,
    moduleA.id,
    { title: 'Lección A1', isPublished: false },
    { id: teacherAuthorized.id, role: teacherAuthorized.role }
  );

  const lessonA2 = await ContentService.createLesson(
    courseA.id,
    moduleA.id,
    { title: 'Lección A2', isPublished: false },
    { id: teacherAuthorized.id, role: teacherAuthorized.role }
  );

  const lessonA3 = await ContentService.createLesson(
    courseA.id,
    moduleA.id,
    { title: 'Lección A3', isPublished: false },
    { id: teacherAuthorized.id, role: teacherAuthorized.role }
  );

  // Create Lessons in Module B
  const lessonB1 = await ContentService.createLesson(
    courseB.id,
    moduleB.id,
    { title: 'Lección B1', isPublished: false },
    { id: admin.id, role: admin.role }
  );

  // Create Assessment in Module A
  const assessmentA1 = await AssessmentService.createAssessment(
    courseA.id,
    teacherAuthorized.id,
    teacherAuthorized.role,
    {
      title: 'Evaluación A1',
      type: AssessmentType.QUIZ,
      weight: 10,
      moduleId: moduleA.id,
      isPublished: false,
    }
  );

  // Future dates helper
  const futureDate1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const futureDate2 = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  const futureDate3 = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // -------------------------------------------------------------
    // TEST 1: Authorized Teacher schedules module
    // -------------------------------------------------------------
    console.log('--- TEST 1: Authorized Teacher schedules module ---');
    const resT1 = await ContentService.scheduleModuleBatch(
      courseA.id,
      moduleA.id,
      { moduleScheduledPublishAt: futureDate1 },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    if (!resT1.module.scheduledPublishAt || resT1.module.isPublished) {
      throw new Error('FAIL T1: Module should be scheduled with isPublished = false');
    }
    console.log('  [PASS] TEST 1: Authorized Teacher scheduled module.\n');

    // -------------------------------------------------------------
    // TEST 2: Authorized Teacher schedules only selected lessons
    // -------------------------------------------------------------
    console.log('--- TEST 2: Authorized Teacher schedules only selected lessons ---');
    const resT2 = await ContentService.scheduleModuleBatch(
      courseA.id,
      moduleA.id,
      {
        contents: [
          { type: 'LESSON', id: lessonA1.id, scheduledPublishAt: futureDate1 },
        ],
      },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    const lesA1Res = resT2.contents.find((c) => c.id === lessonA1.id);
    if (!lesA1Res || !lesA1Res.scheduledPublishAt) {
      throw new Error('FAIL T2: Lesson A1 should be scheduled');
    }
    console.log('  [PASS] TEST 2: Selected lesson scheduled.\n');

    // -------------------------------------------------------------
    // TEST 3: Authorized Teacher schedules selected assessments
    // -------------------------------------------------------------
    console.log('--- TEST 3: Authorized Teacher schedules selected assessments ---');
    const resT3 = await ContentService.scheduleModuleBatch(
      courseA.id,
      moduleA.id,
      {
        contents: [
          { type: 'ASSESSMENT', id: assessmentA1.id, scheduledPublishAt: futureDate2 },
        ],
      },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    const assA1Res = resT3.contents.find((c) => c.id === assessmentA1.id);
    if (!assA1Res || !assA1Res.scheduledPublishAt) {
      throw new Error('FAIL T3: Assessment A1 should be scheduled');
    }
    console.log('  [PASS] TEST 3: Selected assessment scheduled.\n');

    // -------------------------------------------------------------
    // TEST 4: Scheduling with different individual dates
    // -------------------------------------------------------------
    console.log('--- TEST 4: Scheduling with different individual dates ---');
    const resT4 = await ContentService.scheduleModuleBatch(
      courseA.id,
      moduleA.id,
      {
        moduleScheduledPublishAt: futureDate1,
        contents: [
          { type: 'LESSON', id: lessonA1.id, scheduledPublishAt: futureDate1 },
          { type: 'LESSON', id: lessonA2.id, scheduledPublishAt: futureDate2 },
          { type: 'ASSESSMENT', id: assessmentA1.id, scheduledPublishAt: futureDate3 },
        ],
      },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    const itemA1 = resT4.contents.find((c) => c.id === lessonA1.id);
    const itemA2 = resT4.contents.find((c) => c.id === lessonA2.id);
    const itemAss = resT4.contents.find((c) => c.id === assessmentA1.id);
    if (!itemA1?.scheduledPublishAt || !itemA2?.scheduledPublishAt || !itemAss?.scheduledPublishAt) {
      throw new Error('FAIL T4: All items should have their distinct scheduled dates');
    }
    console.log('  [PASS] TEST 4: Different dates assigned correctly.\n');

    // -------------------------------------------------------------
    // TEST 5: Unselected content remains completely untouched
    // -------------------------------------------------------------
    console.log('--- TEST 5: Unselected content remains completely untouched ---');
    // lessonA3 was NOT included in resT4 request
    const dbLessonA3 = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonA3.id } });
    if (dbLessonA3.scheduledPublishAt !== null || dbLessonA3.isPublished !== false) {
      throw new Error('FAIL T5: Unselected Lesson A3 should remain untouched');
    }
    console.log('  [PASS] TEST 5: Unselected content remained untouched.\n');

    // -------------------------------------------------------------
    // TEST 6: scheduledPublishAt = null cancels future schedule
    // -------------------------------------------------------------
    console.log('--- TEST 6: scheduledPublishAt = null cancels future schedule ---');
    const resT6 = await ContentService.scheduleModuleBatch(
      courseA.id,
      moduleA.id,
      {
        contents: [
          { type: 'LESSON', id: lessonA1.id, action: 'UNSCHEDULE' },
        ],
      },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    const itemA1T6 = resT6.contents.find((c) => c.id === lessonA1.id);
    if (itemA1T6?.scheduledPublishAt !== null) {
      throw new Error('FAIL T6: Lesson A1 schedule should be cancelled');
    }
    console.log('  [PASS] TEST 6: Future schedule cancelled successfully.\n');

    // -------------------------------------------------------------
    // TEST 7: Cancel schedule does not unpublish published content
    // -------------------------------------------------------------
    console.log('--- TEST 7: Cancel schedule does not unpublish published content ---');
    // Publish lessonA2 directly
    await prisma.lesson.update({ where: { id: lessonA2.id }, data: { isPublished: true, publishedAt: new Date() } });
    const resT7 = await ContentService.scheduleModuleBatch(
      courseA.id,
      moduleA.id,
      {
        contents: [
          { type: 'LESSON', id: lessonA2.id, action: 'UNSCHEDULE' },
        ],
      },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    const itemA2T7 = resT7.contents.find((c) => c.id === lessonA2.id);
    if (!itemA2T7?.isPublished) {
      throw new Error('FAIL T7: Cancelling schedule must NOT unpublish published content!');
    }
    console.log('  [PASS] TEST 7: Published content remained published after unscheduling.\n');

    // -------------------------------------------------------------
    // TEST 8: Newly created lesson does not inherit schedule
    // -------------------------------------------------------------
    console.log('--- TEST 8: Newly created lesson does not inherit schedule ---');
    const lessonA4 = await ContentService.createLesson(
      courseA.id,
      moduleA.id,
      { title: 'Lección A4 Nueva', isPublished: false },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    if (lessonA4.scheduledPublishAt !== null || lessonA4.isPublished !== false) {
      throw new Error('FAIL T8: New lesson must be created in draft with scheduledPublishAt = null');
    }
    console.log('  [PASS] TEST 8: New lesson created cleanly in draft.\n');

    // -------------------------------------------------------------
    // TEST 9: Content of another module -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 9: Reject content of another module ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        {
          contents: [{ type: 'LESSON', id: lessonB1.id, scheduledPublishAt: futureDate1 }],
        },
        { id: teacherAuthorized.id, role: teacherAuthorized.role }
      );
      throw new Error('FAIL T9: Should have rejected lesson from another module');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError:', err.message);
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 9: Content of another module rejected.\n');

    // -------------------------------------------------------------
    // TEST 10: Content of another course -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 10: Reject content of another course ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        {
          contents: [{ type: 'LESSON', id: lessonB1.id, scheduledPublishAt: futureDate1 }],
        },
        { id: teacherAuthorized.id, role: teacherAuthorized.role }
      );
      throw new Error('FAIL T10: Should have rejected content from another course');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError:', err.message);
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 10: Content of another course rejected.\n');

    // -------------------------------------------------------------
    // TEST 11: Student role -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('--- TEST 11: Reject Student role ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        { moduleScheduledPublishAt: futureDate1 },
        { id: student.id, role: student.role }
      );
      throw new Error('FAIL T11: Should have rejected Student role');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 403) {
        console.log('  Correctly caught 403 Forbidden for Student');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 11: Student role rejected.\n');

    // -------------------------------------------------------------
    // TEST 12: Unauthorized Teacher role -> 403 Forbidden
    // -------------------------------------------------------------
    console.log('--- TEST 12: Reject Unauthorized Teacher role ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        { moduleScheduledPublishAt: futureDate1 },
        { id: teacherUnauthorized.id, role: teacherUnauthorized.role }
      );
      throw new Error('FAIL T12: Should have rejected Unauthorized Teacher');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 403) {
        console.log('  Correctly caught 403 Forbidden for Unauthorized Teacher');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 12: Unauthorized Teacher rejected.\n');

    // -------------------------------------------------------------
    // TEST 13: Duplicate IDs in request -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 13: Reject duplicate IDs in request ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        {
          contents: [
            { type: 'LESSON', id: lessonA1.id, scheduledPublishAt: futureDate1 },
            { type: 'LESSON', id: lessonA1.id, scheduledPublishAt: futureDate2 },
          ],
        },
        { id: teacherAuthorized.id, role: teacherAuthorized.role }
      );
      throw new Error('FAIL T13: Should have rejected duplicate IDs');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError on duplicate IDs');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 13: Duplicate IDs rejected.\n');

    // -------------------------------------------------------------
    // TEST 14: Invalid date string -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 14: Reject invalid date string ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        { moduleScheduledPublishAt: 'invalid-date-string' },
        { id: teacherAuthorized.id, role: teacherAuthorized.role }
      );
      throw new Error('FAIL T14: Should have rejected invalid date string');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError on invalid date');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 14: Invalid date string rejected.\n');

    // -------------------------------------------------------------
    // TEST 15: Past date -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 15: Reject past date for future schedule ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        { moduleScheduledPublishAt: pastDate },
        { id: teacherAuthorized.id, role: teacherAuthorized.role }
      );
      throw new Error('FAIL T15: Should have rejected past date');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError on past date');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 15: Past date rejected.\n');

    // -------------------------------------------------------------
    // TEST 16: Course FINISHED -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 16: Reject scheduling on FINISHED course ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseFinished.id,
        moduleFin.id,
        { moduleScheduledPublishAt: futureDate1 },
        { id: admin.id, role: admin.role }
      );
      throw new Error('FAIL T16: Should have rejected scheduling on FINISHED course');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError on FINISHED course');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 16: FINISHED course rejected.\n');

    // -------------------------------------------------------------
    // TEST 17: Course ARCHIVED -> 400 Bad Request
    // -------------------------------------------------------------
    console.log('--- TEST 17: Reject scheduling on ARCHIVED course ---');
    try {
      await ContentService.scheduleModuleBatch(
        courseArchived.id,
        moduleArc.id,
        { moduleScheduledPublishAt: futureDate1 },
        { id: admin.id, role: admin.role }
      );
      throw new Error('FAIL T17: Should have rejected scheduling on ARCHIVED course');
    } catch (err: any) {
      if (err instanceof AuthError && err.statusCode === 400) {
        console.log('  Correctly caught 400 AuthError on ARCHIVED course');
      } else {
        throw err;
      }
    }
    console.log('  [PASS] TEST 17: ARCHIVED course rejected.\n');

    // -------------------------------------------------------------
    // TEST 18: Publish module only (publishModuleOnly = true)
    // -------------------------------------------------------------
    console.log('--- TEST 18: Publish module only ---');
    // Ensure moduleA is draft
    await prisma.module.update({ where: { id: moduleA.id }, data: { isPublished: false, scheduledPublishAt: futureDate1 } });
    await prisma.lesson.update({ where: { id: lessonA1.id }, data: { isPublished: false, scheduledPublishAt: futureDate1 } });

    const resT18 = await ContentService.publishModuleNow(
      courseA.id,
      moduleA.id,
      { publishModuleOnly: true },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    if (!resT18.module.isPublished) throw new Error('FAIL T18: Module should be published');
    const dbLesA1T18 = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonA1.id } });
    if (dbLesA1T18.isPublished) throw new Error('FAIL T18: Lesson A1 should REMAIN draft when publishModuleOnly = true');
    console.log('  [PASS] TEST 18: Module published alone without publishing lessons.\n');

    // -------------------------------------------------------------
    // TEST 19: Publish module + selected pending content
    // -------------------------------------------------------------
    console.log('--- TEST 19: Publish module + selected pending content ---');
    const resT19 = await ContentService.publishModuleNow(
      courseA.id,
      moduleA.id,
      { publishModuleOnly: false, publishContentIds: [lessonA1.id, assessmentA1.id] },
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    const itemA1T19 = resT19.contents.find((c) => c.id === lessonA1.id);
    const itemAssT19 = resT19.contents.find((c) => c.id === assessmentA1.id);
    if (!itemA1T19?.isPublished || !itemAssT19?.isPublished) {
      throw new Error('FAIL T19: Selected content should be published');
    }
    console.log('  [PASS] TEST 19: Module and selected content published now.\n');

    // -------------------------------------------------------------
    // TEST 20: Unselected pending content NOT published on publish-now
    // -------------------------------------------------------------
    console.log('--- TEST 20: Unselected pending content NOT published on publish-now ---');
    const dbLesA3T20 = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonA3.id } });
    if (dbLesA3T20.isPublished) {
      throw new Error('FAIL T20: Unselected Lesson A3 should remain in draft');
    }
    console.log('  [PASS] TEST 20: Unselected pending content remained unpublished.\n');

    // -------------------------------------------------------------
    // TEST 21: Already published content unaltered on publish-now
    // -------------------------------------------------------------
    console.log('--- TEST 21: Already published content unaltered on publish-now ---');
    const resT21 = await ContentService.publishModuleNow(
      courseA.id,
      moduleA.id,
      { publishModuleOnly: false, publishContentIds: [lessonA1.id] }, // lessonA1 is already published
      { id: teacherAuthorized.id, role: teacherAuthorized.role }
    );
    if (resT21.publishedContentCount !== 0) {
      throw new Error('FAIL T21: Count of newly published content should be 0');
    }
    console.log('  [PASS] TEST 21: Already published content was unaltered.\n');

    // -------------------------------------------------------------
    // TEST 22: Validation failure causes total transaction rollback
    // -------------------------------------------------------------
    console.log('--- TEST 22: Validation failure causes total transaction rollback ---');
    const beforeModA = await prisma.module.findUniqueOrThrow({ where: { id: moduleA.id } });
    try {
      await ContentService.scheduleModuleBatch(
        courseA.id,
        moduleA.id,
        {
          moduleScheduledPublishAt: futureDate3,
          contents: [
            { type: 'LESSON', id: lessonA3.id, scheduledPublishAt: futureDate3 },
            { type: 'LESSON', id: lessonB1.id, scheduledPublishAt: futureDate3 }, // Invalid lesson from Course B!
          ],
        },
        { id: teacherAuthorized.id, role: teacherAuthorized.role }
      );
      throw new Error('FAIL T22: Should have failed batch transaction');
    } catch (err: any) {
      if (err instanceof AuthError) {
        console.log('  Batch transaction failed as expected:', err.message);
      } else {
        throw err;
      }
    }
    const afterLesA3 = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonA3.id } });
    if (afterLesA3.scheduledPublishAt !== null) {
      throw new Error('FAIL T22: Lesson A3 should NOT have been updated due to transaction rollback!');
    }
    console.log('  [PASS] TEST 22: Atomic transaction rolled back completely on error.\n');

  } finally {
    console.log('Cleaning up test data...');
    await prisma.assessment.deleteMany({ where: { courseId: { in: [courseA.id, courseB.id, courseFinished.id, courseArchived.id] } } });
    await prisma.lesson.deleteMany({ where: { module: { courseId: { in: [courseA.id, courseB.id, courseFinished.id, courseArchived.id] } } } });
    await prisma.module.deleteMany({ where: { courseId: { in: [courseA.id, courseB.id, courseFinished.id, courseArchived.id] } } });
    await prisma.courseTeacher.deleteMany({ where: { courseId: { in: [courseA.id, courseB.id, courseFinished.id, courseArchived.id] } } });
    await prisma.course.deleteMany({ where: { id: { in: [courseA.id, courseB.id, courseFinished.id, courseArchived.id] } } });
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['teacher-ak3-auth@test.com', 'teacher-ak3-unauth@test.com', 'student-ak3@test.com'],
          },
        },
      });
      await prisma.subject.deleteMany({ where: { code: 'AK3-SUBJ' } });
    } catch (_e) {
      // Ignore cleanup constraint errors
    }
    console.log('Cleanup finished.');
  }

  console.log('\n🟢 ALL QA-008-AK.3 PHASE 1 INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((e) => {
  console.error('\n🔴 QA-008-AK.3 PHASE 1 TEST SUITE FAILED:', e);
  process.exit(1);
});

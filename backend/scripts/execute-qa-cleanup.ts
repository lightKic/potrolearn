import { prisma, disconnectPrisma } from '../src/lib/prisma';

async function executeQaCleanup() {
  console.log('=== QA DATA CLEANUP EXECUTION START ===\n');

  // 1. Identify QA Users
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } });
  const qaUsers = allUsers.filter(u => 
    u.email.toLowerCase().includes('qa008') || 
    u.email.toLowerCase().includes('qa05') || 
    u.email.toLowerCase().includes('test_') ||
    u.email.toLowerCase().includes('qa_') ||
    u.name.toLowerCase().includes('qa008') ||
    u.name.toLowerCase().includes('qa05')
  );
  const qaUserIds = qaUsers.map(u => u.id);

  // 2. Identify QA Subjects
  const allSubjects = await prisma.subject.findMany({ select: { id: true, code: true, name: true } });
  const qaSubjects = allSubjects.filter(s => 
    s.code.toLowerCase().includes('qa') || 
    s.name.toLowerCase().includes('qa') ||
    s.name.toLowerCase().includes('test')
  );
  const qaSubjectIds = qaSubjects.map(s => s.id);

  // 3. Identify QA Courses
  const allCourses = await prisma.course.findMany({ select: { id: true, name: true, subjectId: true, createdById: true } });
  const qaCourses = allCourses.filter(c => 
    c.name.toLowerCase().includes('qa') || 
    qaSubjectIds.includes(c.subjectId) ||
    (c.createdById && qaUserIds.includes(c.createdById))
  );
  const qaCourseIds = qaCourses.map(c => c.id);

  console.log(`Identified for deletion:`);
  console.log(`- Users: ${qaUsers.length}`);
  console.log(`- Subjects: ${qaSubjects.length}`);
  console.log(`- Courses: ${qaCourses.length}`);

  // 4. Identify Assessments to delete
  const qaAssessments = await prisma.assessment.findMany({
    where: { courseId: { in: qaCourseIds } },
    select: { id: true }
  });
  const qaAssessmentIds = qaAssessments.map(a => a.id);

  // 5. Identify Attempts to delete
  const qaAttempts = await prisma.attempt.findMany({
    where: {
      OR: [
        { studentId: { in: qaUserIds } },
        { assessmentId: { in: qaAssessmentIds } }
      ]
    },
    select: { id: true }
  });
  const qaAttemptIds = qaAttempts.map(a => a.id);

  console.log(`- Dependent Assessments: ${qaAssessmentIds.length}`);
  console.log(`- Dependent Attempts: ${qaAttemptIds.length}`);

  // Perform deletion in reverse dependency order
  console.log('\n--- DELETING DEPENDENT RECORDS ---');

  // Delete AssessmentAttemptGrants
  const deletedGrants = await prisma.assessmentAttemptGrant.deleteMany({
    where: {
      OR: [
        { studentId: { in: qaUserIds } },
        { assessmentId: { in: qaAssessmentIds } }
      ]
    }
  });
  console.log(`Deleted AssessmentAttemptGrants: ${deletedGrants.count}`);

  // Delete AnswerOptions for Answers in QA Attempts
  const qaAnswers = await prisma.answer.findMany({
    where: { attemptId: { in: qaAttemptIds } },
    select: { id: true }
  });
  const qaAnswerIds = qaAnswers.map(a => a.id);

  const deletedAnswerOptions = await prisma.answerOption.deleteMany({
    where: { answerId: { in: qaAnswerIds } }
  });
  console.log(`Deleted AnswerOptions: ${deletedAnswerOptions.count}`);

  // Delete Answers
  const deletedAnswers = await prisma.answer.deleteMany({
    where: { attemptId: { in: qaAttemptIds } }
  });
  console.log(`Deleted Answers: ${deletedAnswers.count}`);

  // Delete Attempts
  const deletedAttempts = await prisma.attempt.deleteMany({
    where: { id: { in: qaAttemptIds } }
  });
  console.log(`Deleted Attempts: ${deletedAttempts.count}`);

  // Delete AssessmentQuestions
  const deletedAssessmentQuestions = await prisma.assessmentQuestion.deleteMany({
    where: { assessmentId: { in: qaAssessmentIds } }
  });
  console.log(`Deleted AssessmentQuestions: ${deletedAssessmentQuestions.count}`);

  // Delete Assessments
  const deletedAssessments = await prisma.assessment.deleteMany({
    where: { id: { in: qaAssessmentIds } }
  });
  console.log(`Deleted Assessments: ${deletedAssessments.count}`);

  // Delete Questions in QA Subjects
  const deletedQuestions = await prisma.question.deleteMany({
    where: { subjectId: { in: qaSubjectIds } }
  });
  console.log(`Deleted Questions: ${deletedQuestions.count}`);

  // Delete Enrollments
  const deletedEnrollments = await prisma.enrollment.deleteMany({
    where: {
      OR: [
        { studentId: { in: qaUserIds } },
        { courseId: { in: qaCourseIds } }
      ]
    }
  });
  console.log(`Deleted Enrollments: ${deletedEnrollments.count}`);

  // Delete CourseTeachers
  const deletedCourseTeachers = await prisma.courseTeacher.deleteMany({
    where: {
      OR: [
        { teacherId: { in: qaUserIds } },
        { courseId: { in: qaCourseIds } }
      ]
    }
  });
  console.log(`Deleted CourseTeachers: ${deletedCourseTeachers.count}`);

  // Delete SubjectTeachers
  const deletedSubjectTeachers = await prisma.subjectTeacher.deleteMany({
    where: {
      OR: [
        { teacherId: { in: qaUserIds } },
        { subjectId: { in: qaSubjectIds } }
      ]
    }
  });
  console.log(`Deleted SubjectTeachers: ${deletedSubjectTeachers.count}`);

  // Delete Courses
  const deletedCourses = await prisma.course.deleteMany({
    where: { id: { in: qaCourseIds } }
  });
  console.log(`Deleted Courses: ${deletedCourses.count}`);

  // Delete Subjects
  const deletedSubjects = await prisma.subject.deleteMany({
    where: { id: { in: qaSubjectIds } }
  });
  console.log(`Deleted Subjects: ${deletedSubjects.count}`);

  // Delete Users
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: qaUserIds } }
  });
  console.log(`Deleted Users: ${deletedUsers.count}`);

  console.log('\n=== VERIFYING REMAINING REAL DATA ===');
  const remainingUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const remainingSubjects = await prisma.subject.findMany({ select: { id: true, code: true, name: true } });
  const remainingCourses = await prisma.course.findMany({ select: { id: true, name: true } });

  console.log(`Remaining Real Users (${remainingUsers.length}):`);
  remainingUsers.forEach(u => console.log(` - [${u.role}] ${u.email}`));

  console.log(`\nRemaining Real Subjects (${remainingSubjects.length}):`);
  remainingSubjects.forEach(s => console.log(` - ${s.code}: ${s.name}`));

  console.log(`\nRemaining Real Courses (${remainingCourses.length}):`);
  remainingCourses.forEach(c => console.log(` - ${c.name}`));

  console.log('\n=== QA DATA CLEANUP EXECUTION SUCCESSFUL ===');
  await disconnectPrisma();
}

executeQaCleanup().catch(async (e) => {
  console.error('ERROR during QA data cleanup:', e);
  await disconnectPrisma();
  process.exit(1);
});

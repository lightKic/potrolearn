import { prisma, disconnectPrisma } from '../src/lib/prisma';

async function auditQaData() {
  console.log('=== DB AUDIT START ===\n');

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });
  console.log(`Total Users in DB: ${users.length}`);

  const qaUsers = users.filter(u => 
    u.email.toLowerCase().includes('qa008') || 
    u.email.toLowerCase().includes('qa05') || 
    u.email.toLowerCase().includes('test_') ||
    u.email.toLowerCase().includes('qa_') ||
    u.name.toLowerCase().includes('qa008') ||
    u.name.toLowerCase().includes('qa05') ||
    u.name.toLowerCase().includes('qa')
  );
  console.log('\n--- QA USERS IDENTIFIED ---');
  qaUsers.forEach(u => console.log(`[${u.role}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name}`));

  const subjects = await prisma.subject.findMany({
    select: { id: true, code: true, name: true, createdAt: true }
  });
  console.log(`\nTotal Subjects in DB: ${subjects.length}`);
  const qaSubjects = subjects.filter(s => 
    s.code.toLowerCase().includes('qa') || 
    s.name.toLowerCase().includes('qa') ||
    s.name.toLowerCase().includes('test')
  );
  console.log('\n--- QA SUBJECTS IDENTIFIED ---');
  qaSubjects.forEach(s => console.log(`ID: ${s.id} | Code: ${s.code} | Name: ${s.name}`));

  const qaSubjectIds = qaSubjects.map(s => s.id);
  const qaUserIds = qaUsers.map(u => u.id);

  const courses = await prisma.course.findMany({
    select: { id: true, name: true, subjectId: true, createdById: true }
  });
  console.log(`\nTotal Courses in DB: ${courses.length}`);
  const qaCourses = courses.filter(c => 
    c.name.toLowerCase().includes('qa') || 
    qaSubjectIds.includes(c.subjectId) ||
    (c.createdById && qaUserIds.includes(c.createdById))
  );
  console.log('\n--- QA COURSES IDENTIFIED ---');
  qaCourses.forEach(c => console.log(`ID: ${c.id} | Name: ${c.name} | SubjectId: ${c.subjectId}`));

  const qaCourseIds = qaCourses.map(c => c.id);

  const subjectTeachers = await prisma.subjectTeacher.findMany({
    include: {
      subject: { select: { code: true, name: true } },
      teacher: { select: { email: true, name: true } }
    }
  });
  console.log(`\nTotal SubjectTeachers in DB: ${subjectTeachers.length}`);
  const qaSubjectTeachers = subjectTeachers.filter(st => 
    st.subject.code.toLowerCase().includes('qa') ||
    st.subject.name.toLowerCase().includes('qa') ||
    st.teacher.email.toLowerCase().includes('qa') ||
    st.teacher.name.toLowerCase().includes('qa') ||
    qaSubjectIds.includes(st.subjectId) ||
    qaUserIds.includes(st.teacherId)
  );
  console.log('\n--- QA SUBJECT TEACHERS IDENTIFIED ---');
  qaSubjectTeachers.forEach(st => console.log(`ID: ${st.id} | Subject: ${st.subject.name} | Teacher: ${st.teacher.email}`));

  const courseTeachers = await prisma.courseTeacher.findMany({
    include: {
      course: { select: { name: true } },
      teacher: { select: { email: true } }
    }
  });
  console.log(`\nTotal CourseTeachers in DB: ${courseTeachers.length}`);
  const qaCourseTeachers = courseTeachers.filter(ct => 
    ct.course.name.toLowerCase().includes('qa') ||
    ct.teacher.email.toLowerCase().includes('qa') ||
    qaUserIds.includes(ct.teacherId) ||
    qaCourseIds.includes(ct.courseId)
  );
  console.log('\n--- QA COURSE TEACHERS IDENTIFIED ---');
  qaCourseTeachers.forEach(ct => console.log(`ID: ${ct.id} | Course: ${ct.course.name} | Teacher: ${ct.teacher.email}`));

  const qaAssessments = await prisma.assessment.findMany({
    where: {
      courseId: { in: qaCourseIds }
    },
    select: { id: true, title: true, courseId: true }
  });
  console.log(`\nQA Assessments dependent on QA Courses: ${qaAssessments.length}`);
  qaAssessments.forEach(a => console.log(`ID: ${a.id} | Title: ${a.title}`));

  const qaAttempts = await prisma.attempt.findMany({
    where: {
      OR: [
        { studentId: { in: qaUserIds } },
        { assessmentId: { in: qaAssessments.map(a => a.id) } }
      ]
    },
    select: { id: true, studentId: true }
  });
  console.log(`QA Attempts dependent: ${qaAttempts.length}`);

  const qaEnrollments = await prisma.enrollment.findMany({
    where: {
      OR: [
        { studentId: { in: qaUserIds } },
        { courseId: { in: qaCourseIds } }
      ]
    },
    select: { id: true, studentId: true, courseId: true }
  });
  console.log(`QA Enrollments dependent: ${qaEnrollments.length}`);

  const qaQuestions = await prisma.question.findMany({
    where: {
      subjectId: { in: qaSubjectIds }
    },
    select: { id: true, statement: true }
  });
  console.log(`QA Questions dependent: ${qaQuestions.length}`);

  console.log('\n--- REAL (SAFE) USERS TO PRESERVE ---');
  users.filter(u => !qaUserIds.includes(u.id)).forEach(u => console.log(`[${u.role}] ID: ${u.id} | ${u.email} (${u.name})`));

  console.log('\n--- REAL (SAFE) SUBJECTS TO PRESERVE ---');
  subjects.filter(s => !qaSubjectIds.includes(s.id)).forEach(s => console.log(`ID: ${s.id} | ${s.code} - ${s.name}`));

  console.log('\n--- REAL (SAFE) COURSES TO PRESERVE ---');
  courses.filter(c => !qaCourseIds.includes(c.id)).forEach(c => console.log(`ID: ${c.id} | ${c.name}`));

  console.log('\n=== DB AUDIT END ===');
  await disconnectPrisma();
}

auditQaData().catch(async (e) => {
  console.error(e);
  await disconnectPrisma();
});

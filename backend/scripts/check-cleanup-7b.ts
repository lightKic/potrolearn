import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.count({ where: { email: { contains: '7b_' } } });
  const courses = await prisma.course.count({ where: { name: { contains: '7B' } } });
  const subjects = await prisma.subject.count({ where: { code: { contains: '7B' } } });
  const modules = await prisma.module.count({ where: { title: { contains: '7B' } } });
  const lessons = await prisma.lesson.count({ where: { title: { contains: '7B' } } });

  const total = users + courses + subjects + modules + lessons;
  console.log('TEMPORARY_7B_RECORDS_REMAINING:', total);
}

main().finally(async () => {
  await prisma.$disconnect();
});

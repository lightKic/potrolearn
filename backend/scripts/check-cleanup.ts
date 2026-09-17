import { prisma } from '../src/lib/prisma';

async function main() {
  const countMods = await prisma.module.count({ where: { title: { contains: '7A' } } });
  const countLes = await prisma.lesson.count({ where: { title: { contains: '7A' } } });
  console.log('REMAINING_TEST_RECORDS:', countMods + countLes);
}

main().finally(async () => {
  await prisma.$disconnect();
});

import { prisma, disconnectPrisma } from '../src/lib/prisma';

async function main() {
  const attempts = await prisma.attempt.findMany({
    where: {
      assessmentId: 'd8067fbb-5733-4d7b-9261-1d68a7b6b161',
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      answers: true,
      assessment: {
        include: {
          assessmentQuestions: true,
        },
      },
    },
  });

  console.log(`Encontrados ${attempts.length} intentos para Assessment d8067fbb-5733-4d7b-9261-1d68a7b6b161:\n`);

  for (const att of attempts) {
    console.log(`==================================================`);
    console.log(`Attempt ID: ${att.id}`);
    console.log(`Student ID: ${att.studentId}`);
    console.log(`Status: ${att.status}`);
    console.log(`Score: ${att.score}`);
    console.log(`StartedAt: ${att.startedAt.toISOString()}`);
    console.log(`Answers en DB (count): ${att.answers.length}`);

    att.answers.forEach((ans, idx) => {
      console.log(`  Ans #${idx + 1} | Q_ID: ${ans.questionId} | TextValue: "${ans.textValue}" | IsCorrect: ${ans.isCorrect} | PointsEarned: ${ans.pointsEarned}`);
    });
  }
}

main()
  .catch((err) => console.error(err))
  .finally(async () => {
    await disconnectPrisma();
  });

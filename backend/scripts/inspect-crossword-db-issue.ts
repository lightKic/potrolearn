import { prisma, disconnectPrisma } from '../src/lib/prisma';

async function main() {
  const assessments = await prisma.assessment.findMany({
    where: { type: 'CROSSWORD' },
    include: {
      assessmentQuestions: {
        orderBy: { order: 'asc' },
        include: {
          question: {
            include: {
              options: true,
            },
          },
        },
      },
      attempts: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          answers: true,
        },
      },
    },
  });

  console.log(`Encontrados ${assessments.length} assessments de tipo CROSSWORD:\n`);

  for (const a of assessments) {
    console.log(`==================================================`);
    console.log(`Assessment ID: ${a.id}`);
    console.log(`Title: ${a.title}`);
    console.log(`Type: ${a.type}`);
    console.log(`Status: ${(a as any).status || 'N/A'}`);
    console.log(`Total AssessmentQuestions: ${a.assessmentQuestions.length}`);

    const layout = a.crosswordLayout as any;
    console.log(`GridSize: ${layout?.gridSize || 'N/A'}`);
    const entries = layout?.entries || [];
    console.log(`Layout Entries: ${entries.length}`);

    console.log(`\n--- PREGUNTAS DE LA EVALUACIÓN (${a.assessmentQuestions.length}) ---`);
    a.assessmentQuestions.forEach((aq: any, idx: number) => {
      console.log(
        `#${idx + 1} | Order: ${aq.order} | AQ_ID: ${aq.id} | Q_ID: ${aq.question.id} | Statement: "${aq.question.statement}" | Points: ${aq.points} | Type: ${aq.question.type}`
      );
      aq.question.options.forEach((opt: any) => {
        console.log(`    Option: "${opt.text}" (Correct: ${opt.isCorrect})`);
      });
    });

    console.log(`\n--- ENTRADAS DEL CROSSWORD LAYOUT (${entries.length}) ---`);
    entries.forEach((e: any, idx: number) => {
      console.log(
        `Entry #${idx + 1} | QuestionID: ${e.questionId} | #${e.number} ${e.direction} | Row:${e.startRow} Col:${e.startCol} | Length:${e.length}`
      );
    });

    console.log(`\n--- ATTEMPTS MÁS RECIENTES (${a.attempts.length}) ---`);
    a.attempts.forEach((att: any) => {
      console.log(`Attempt ID: ${att.id} | StudentID: ${att.studentId} | Status: ${att.status} | Score: ${att.score}`);
      console.log(`Respuestas guardadas: ${att.answers.length}`);
      att.answers.forEach((ans: any) => {
        console.log(`  Ans Q_ID: ${ans.questionId} | TextValue: "${ans.textValue}" | IsCorrect: ${ans.isCorrect} | PointsEarned: ${ans.pointsEarned}`);
      });
    });
  }
}

main()
  .catch((err) => console.error(err))
  .finally(async () => {
    await disconnectPrisma();
  });

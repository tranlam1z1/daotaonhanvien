import { BadRequestException } from '@nestjs/common';
import type { AssessmentQuestionType, Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export type QuizQuestion = {
  type: AssessmentQuestionType;
  prompt: string;
  options: string[];
  correctOptions: number[];
  explanation: string;
};

export type QuizDefinition = {
  selectionMode: 'FIXED' | 'RANDOM';
  randomCount: number | null;
  timeLimitMinutes: number;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswers: boolean;
  questions: QuizQuestion[];
};

export type QuizDefinitions = Record<string, QuizDefinition>;
export type QuizAnswers = Record<string, number[]>;

export async function snapshotQuizzes(
  db: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
): Promise<QuizDefinitions> {
  if (!ids.length) return {};
  const quizzes = await db.quiz.findMany({
    where: { tenantId, id: { in: ids }, selectionMode: { not: null } },
    select: {
      id: true,
      selectionMode: true,
      randomCount: true,
      timeLimitMinutes: true,
      passingScore: true,
      maxAttempts: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      showAnswers: true,
      questions: {
        orderBy: { position: 'asc' },
        select: {
          question: {
            select: {
              type: true,
              prompt: true,
              options: true,
              correctOptions: true,
              explanation: true,
            },
          },
        },
      },
    },
  });
  return Object.fromEntries(
    quizzes.flatMap(({ id, questions, ...settings }) => {
      if (
        !settings.selectionMode ||
        settings.timeLimitMinutes === null ||
        settings.passingScore === null ||
        settings.maxAttempts === null ||
        !questions.length
      )
        return [];
      return [
        [
          id,
          {
            ...settings,
            selectionMode: settings.selectionMode,
            timeLimitMinutes: settings.timeLimitMinutes,
            passingScore: settings.passingScore,
            maxAttempts: settings.maxAttempts,
            questions: questions.map(({ question }) => question),
          },
        ],
      ];
    }),
  );
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createPaper(quiz: QuizDefinition) {
  const selected =
    quiz.selectionMode === 'RANDOM'
      ? shuffle(quiz.questions).slice(0, quiz.randomCount!)
      : quiz.questions;
  return (quiz.shuffleQuestions ? shuffle(selected) : selected).map(
    (question) => {
      if (!quiz.shuffleOptions) return question;
      const options = shuffle(
        question.options.map((text, index) => ({
          text,
          correct: question.correctOptions.includes(index + 1),
        })),
      );
      return {
        ...question,
        options: options.map(({ text }) => text),
        correctOptions: options.flatMap(({ correct }, index) =>
          correct ? [index + 1] : [],
        ),
      };
    },
  );
}

export function readAnswers(
  body: unknown,
  questions: QuizQuestion[],
): QuizAnswers {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw invalidAnswers();
  const answers: QuizAnswers = {};
  for (const [index, selection] of Object.entries(body)) {
    const position = Number(index);
    const question = questions[position];
    if (
      !Number.isInteger(position) ||
      String(position) !== index ||
      !question ||
      !Array.isArray(selection) ||
      selection.length > question.options.length ||
      (question.type !== 'MULTIPLE_CHOICE' && selection.length > 1) ||
      selection.some(
        (value) =>
          !Number.isInteger(value) ||
          value < 1 ||
          value > question.options.length,
      )
    ) {
      throw invalidAnswers();
    }
    answers[index] = [...new Set<number>(selection)].sort((a, b) => a - b);
  }
  return answers;
}

export function grade(questions: QuizQuestion[], answers: QuizAnswers) {
  const correct = questions.filter((question, index) =>
    isDeepStrictEqual(
      answers[index],
      [...question.correctOptions].sort((a, b) => a - b),
    ),
  ).length;
  return (correct / questions.length) * 100;
}

function invalidAnswers() {
  return new BadRequestException('Câu trả lời không hợp lệ.');
}

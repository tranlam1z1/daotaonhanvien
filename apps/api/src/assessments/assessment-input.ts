import { BadRequestException } from '@nestjs/common';
import { idInput, object, text } from '../knowledge/knowledge-input';

const questionTypes = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
] as const;
const maxInteger = 2_147_483_647;
export const trueFalseOptions = ['Đúng', 'Sai'];

function optionalId(value: unknown) {
  return value == null || value === '' ? null : idInput(value);
}

export function questionGroup(body: unknown) {
  const data = object(body);
  const courseId = optionalId(data.courseId);
  const topic = text(data.topic ?? '', 160, 'Chủ đề') || null;
  if ((courseId === null) === (topic === null)) {
    throw new BadRequestException('Chọn một khóa học hoặc nhập một chủ đề.');
  }
  return { departmentId: optionalId(data.departmentId), courseId, topic };
}

export function questionInput(body: unknown) {
  const data = object(body);
  const type = questionTypes.find((entry) => entry === data.type);
  if (!type) throw new BadRequestException('Loại câu hỏi không hợp lệ.');

  let options = trueFalseOptions;
  if (type !== 'TRUE_FALSE') {
    if (
      !Array.isArray(data.options) ||
      data.options.length < 2 ||
      data.options.length > 20
    ) {
      throw new BadRequestException('Câu hỏi cần từ 2 đến 20 phương án.');
    }
    options = data.options.map((entry) => text(entry, 1000, 'Phương án', true));
    if (
      new Set(options.map((entry) => entry.toLocaleLowerCase('vi'))).size !==
      options.length
    ) {
      throw new BadRequestException('Các phương án phải khác nhau.');
    }
  }
  if (
    !Array.isArray(data.correctOptions) ||
    data.correctOptions.length < 1 ||
    data.correctOptions.length > options.length ||
    data.correctOptions.some(
      (entry) =>
        !Number.isInteger(entry) || entry < 1 || entry > options.length,
    ) ||
    new Set(data.correctOptions).size !== data.correctOptions.length ||
    (type !== 'MULTIPLE_CHOICE' && data.correctOptions.length !== 1)
  ) {
    throw new BadRequestException('Đáp án đúng không hợp lệ.');
  }
  return {
    type,
    prompt: text(data.prompt, 3000, 'Câu hỏi', true),
    options,
    correctOptions: (data.correctOptions as number[]).sort((a, b) => a - b),
    explanation: text(data.explanation, 3000, 'Giải thích'),
  };
}

function integer(value: unknown, min: number, max: number, label: string) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new BadRequestException(label + ' không hợp lệ.');
  }
  return value;
}

function flag(value: unknown, label: string) {
  if (typeof value !== 'boolean')
    throw new BadRequestException(label + ' không hợp lệ.');
  return value;
}

export function quizInput(body: unknown) {
  const data = object(body);
  if (data.selectionMode !== 'FIXED' && data.selectionMode !== 'RANDOM') {
    throw new BadRequestException('Cách chọn câu hỏi không hợp lệ.');
  }
  if (
    !Array.isArray(data.questionIds) ||
    data.questionIds.length < 1 ||
    data.questionIds.length > 200
  ) {
    throw new BadRequestException(
      'Chọn từ 1 đến 200 câu hỏi cho bài kiểm tra.',
    );
  }
  const questionIds = data.questionIds.map(idInput);
  if (new Set(questionIds).size !== questionIds.length)
    throw new BadRequestException('Bài kiểm tra chứa câu hỏi trùng lặp.');

  return {
    departmentId: optionalId(data.departmentId),
    questionIds,
    settings: {
      name: text(data.name, 160, 'Tên bài kiểm tra', true),
      selectionMode: data.selectionMode,
      randomCount:
        data.selectionMode === 'RANDOM'
          ? integer(
              data.randomCount,
              1,
              questionIds.length,
              'Số câu rút ngẫu nhiên',
            )
          : null,
      timeLimitMinutes: integer(
        data.timeLimitMinutes,
        1,
        maxInteger,
        'Thời gian làm bài',
      ),
      passingScore: integer(data.passingScore, 0, 100, 'Điểm đạt'),
      maxAttempts: integer(
        data.maxAttempts,
        1,
        maxInteger,
        'Số lần làm tối đa',
      ),
      shuffleQuestions: flag(data.shuffleQuestions, 'Xáo trộn câu hỏi'),
      shuffleOptions: flag(data.shuffleOptions, 'Xáo trộn phương án'),
      showAnswers: flag(data.showAnswers, 'Hiển thị đáp án'),
    },
  } as const;
}

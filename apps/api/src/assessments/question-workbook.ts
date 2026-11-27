import { BadRequestException } from '@nestjs/common';
import { Workbook, type CellValue } from 'exceljs';
import { checkWorkbookZip } from '../spreadsheets/workbook-zip';

const columns = [
  'Loại câu hỏi',
  'Câu hỏi',
  'Phương án',
  'Đáp án đúng',
  'Giải thích',
];
const rowLimit = 500;
export const questionUploadLimit = 2 * 1024 * 1024;
const types = new Map<string, string>([
  ['Một đáp án', 'SINGLE_CHOICE'],
  ['Nhiều đáp án', 'MULTIPLE_CHOICE'],
  ['Đúng/Sai', 'TRUE_FALSE'],
]);

export async function questionTemplate() {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Câu hỏi', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = columns.map((header) => ({
    header,
    width: 32,
    style: { numFmt: '@' },
  }));
  const help = workbook.addWorksheet('Hướng dẫn');
  help.getColumn(1).width = 100;
  help.addRows([
    ['Điền câu hỏi trong trang Câu hỏi. Giữ nguyên tiêu đề cột.'],
    ['Loại câu hỏi: Một đáp án, Nhiều đáp án hoặc Đúng/Sai.'],
    ['Phương án: nhập mỗi phương án trên một dòng trong cùng một ô.'],
    ['Đáp án đúng: nhập số thứ tự bắt đầu từ 1 (ví dụ: 1,3).'],
    ['Câu Đúng/Sai để trống phương án. Đáp án 1 là Đúng và 2 là Sai.'],
    ['Giải thích có thể để trống. Không dùng công thức.'],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function cellText(value: CellValue): unknown {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map(({ text }) => text).join('');
  }
  return value;
}

export async function readQuestionWorkbook(file?: Buffer) {
  if (!file?.length || file.length > questionUploadLimit)
    throw new BadRequestException('Vui lòng chọn tệp Excel .xlsx tối đa 2 MB.');
  const workbook = new Workbook();
  try {
    await checkWorkbookZip(file);
    await workbook.xlsx.load(Uint8Array.from(file).buffer);
  } catch {
    throw new BadRequestException('Không đọc được tệp Excel .xlsx.');
  }
  const sheet = workbook.worksheets[0];
  if (
    !sheet ||
    columns.some(
      (header, index) => sheet.getRow(1).getCell(index + 1).value !== header,
    )
  )
    throw new BadRequestException('Tiêu đề cột sai. Vui lòng dùng tệp mẫu.');
  if (sheet.rowCount > rowLimit + 1)
    throw new BadRequestException('Tệp chỉ được có tối đa 500 dòng câu hỏi.');

  const rows: { row: number; fields: Record<string, unknown> }[] = [];
  sheet.eachRow((line, row) => {
    if (row === 1) return;
    const [type, prompt, options, correct, explanation] = columns.map(
      (_, index) => cellText(line.getCell(index + 1).value),
    );
    if (
      [type, prompt, options, correct, explanation].every(
        (value) => value === '',
      )
    )
      return;
    rows.push({
      row,
      fields: {
        type: typeof type === 'string' ? types.get(type.trim()) : type,
        prompt,
        options:
          typeof options === 'string' ? options.trim().split(/\r?\n/) : options,
        correctOptions:
          typeof correct === 'string' &&
          /^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/.test(correct.trim())
            ? correct.split(',').map(Number)
            : undefined,
        explanation,
      },
    });
  });
  if (!rows.length) throw new BadRequestException('Tệp chưa có câu hỏi.');
  return rows;
}

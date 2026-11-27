import { BadRequestException } from '@nestjs/common';
import { Workbook, type CellValue } from 'exceljs';
import { checkWorkbookZip } from '../spreadsheets/workbook-zip';
import { employeeColumns, type EmployeeField } from './employee-input';

const columns = Object.keys(employeeColumns) as EmployeeField[];
export const employeeUploadLimit = 2 * 1024 * 1024;
const rowLimit = 2000;

export async function employeeTemplate(catalogs: {
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  employees: { id: string; fullName: string; employeeCode: string | null }[];
}) {
  const workbook = new Workbook();
  const employees = workbook.addWorksheet('Nhân viên', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  employees.columns = columns.map((key) => ({
    header: employeeColumns[key],
    width: 32,
    style: { numFmt: '@' },
  }));
  const sources = [
    {
      name: 'Phòng ban',
      rows: catalogs.departments.map((item) => [item.id, item.name]),
    },
    {
      name: 'Chức danh',
      rows: catalogs.positions.map((item) => [item.id, item.name]),
    },
    {
      name: 'Quản lý trực tiếp',
      rows: catalogs.employees.map((item) => [
        item.id,
        item.fullName,
        item.employeeCode,
      ]),
    },
  ];
  for (const { name, rows } of sources) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'ID', width: 40 },
      { header: 'Tên', width: 32 },
      { header: 'Mã nhân viên', width: 20 },
    ];
    sheet.addRows(rows);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function cellInput(value: CellValue, field: EmployeeField) {
  if (value instanceof Date && field === 'joinedAt')
    return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && field === 'employeeCode')
    return String(value);
  if (value && typeof value === 'object' && 'richText' in value)
    return value.richText.map(({ text }) => text).join('');
  return value;
}

export async function readEmployeeWorkbook(file?: Buffer) {
  if (!file?.length || file.length > employeeUploadLimit)
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
      (key, index) =>
        sheet.getRow(1).getCell(index + 1).text !== employeeColumns[key],
    )
  )
    throw new BadRequestException('Tiêu đề cột sai. Vui lòng dùng tệp mẫu.');
  if (sheet.rowCount > rowLimit + 1)
    throw new BadRequestException(
      `Tệp chỉ được có tối đa ${rowLimit} dòng nhân viên.`,
    );
  const rows: { row: number; fields: Record<string, unknown> }[] = [];
  sheet.eachRow((line, row) => {
    if (row === 1) return;
    const fields = Object.fromEntries(
      columns.map((key, index) => [
        key,
        cellInput(line.getCell(index + 1).value, key),
      ]),
    );
    if (Object.values(fields).some((value) => value !== null && value !== ''))
      rows.push({ row, fields });
  });
  if (!rows.length) throw new BadRequestException('Tệp chưa có nhân viên.');
  return rows;
}

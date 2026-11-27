import { BadRequestException } from '@nestjs/common';

export interface LeadInput {
  fullName: string;
  jobTitle: string;
  companyName: string;
  companySize: string;
  phone: string;
  consent: true;
}

export function parseLead(body: unknown): LeadInput | null {
  const invalid = () =>
    new BadRequestException(
      'Vui lòng điền đầy đủ thông tin, số điện thoại Việt Nam và đồng ý xử lý dữ liệu cá nhân.',
    );
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const data = body as Record<string, unknown>;
  if (typeof data.website === 'string' && data.website.trim()) return null;
  const text = (field: string, max: number) => {
    const value = data[field];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
      throw invalid();
    return value.trim();
  };
  const fullName = text('fullName', 200);
  const jobTitle = text('jobTitle', 200);
  const companyName = text('companyName', 300);
  const companySize = text('companySize', 20);
  const phone = text('phone', 40)
    .replace(/[\s.()-]/g, '')
    .replace(/^\+84/, '0');
  if (
    !['under-30', '30-100', 'over-100'].includes(companySize) ||
    !/^(0[35789]\d{8}|02\d{9})$/.test(phone) ||
    data.consent !== true ||
    (data.website !== undefined && typeof data.website !== 'string')
  )
    throw invalid();
  return { fullName, jobTitle, companyName, companySize, phone, consent: true };
}

export interface PilotRegistration {
  fullName: string;
  jobTitle: string;
  companyName: string;
  companySize: string;
  phone: string;
  consent: true;
  website: string;
}
export function parsePilotRegistration(
  data: FormData,
): PilotRegistration | null {
  const value = (key: string) => String(data.get(key) ?? '').trim();
  const fullName = value('fullName'),
    jobTitle = value('jobTitle'),
    companyName = value('companyName'),
    companySize = value('companySize'),
    phone = value('phone');
  const normalizedPhone = phone.replace(/[\s.()-]/g, '').replace(/^\+84/, '0');
  if (
    !fullName ||
    !jobTitle ||
    !companyName ||
    !['under-30', '30-100', 'over-100'].includes(companySize) ||
    !/^(0[35789]\d{8}|02\d{9})$/.test(normalizedPhone) ||
    data.get('consent') !== 'on'
  )
    return null;
  return {
    fullName,
    jobTitle,
    companyName,
    companySize,
    phone,
    consent: true,
    website: value('website'),
  };
}

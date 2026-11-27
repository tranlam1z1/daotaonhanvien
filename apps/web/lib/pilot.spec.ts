import { parsePilotRegistration } from './pilot';
function registration(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    fullName: ' Nguyễn Văn An ',
    jobTitle: 'Giám đốc',
    companyName: 'Công ty Thanh Hóa',
    companySize: '30-100',
    phone: '0912 345 678',
    consent: 'on',
    website: '',
    ...overrides,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}
describe('Pilot registration browser validation', () => {
  it('trims required fields and includes explicit consent and honeypot', () => {
    expect(parsePilotRegistration(registration())).toEqual({
      fullName: 'Nguyễn Văn An',
      jobTitle: 'Giám đốc',
      companyName: 'Công ty Thanh Hóa',
      companySize: '30-100',
      phone: '0912 345 678',
      consent: true,
      website: '',
    });
  });
  it.each(['+84 912 345 678', '0912.345.678', '0237 3851 234'])(
    'accepts Vietnamese number %s',
    (phone) => {
      expect(parsePilotRegistration(registration({ phone }))).not.toBeNull();
    },
  );
  it.each([
    '',
    '   ',
    '12345678',
    '+1 2025550199',
    '0112345678',
    '09123456789',
  ])('rejects invalid number %s', (phone) => {
    expect(parsePilotRegistration(registration({ phone }))).toBeNull();
  });
  it.each(['fullName', 'jobTitle', 'companyName', 'companySize', 'consent'])(
    'requires %s',
    (field) => {
      expect(parsePilotRegistration(registration({ [field]: '' }))).toBeNull();
    },
  );
  it('rejects a fabricated company size', () => {
    expect(
      parsePilotRegistration(registration({ companySize: 'anything' })),
    ).toBeNull();
  });
  it('keeps user content as data and sends the honeypot for server handling in T02', () => {
    const fullName = '<img src=x onerror="alert(1)">';
    expect(
      parsePilotRegistration(
        registration({ fullName, website: 'spam.example' }),
      ),
    ).toMatchObject({ fullName, website: 'spam.example' });
  });
});

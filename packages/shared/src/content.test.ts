import {
  announcementSchema,
  contactSchema,
  documentSchema,
  localized,
  telegramUrlField,
  whatsappUrlField,
} from './content';

const contact = {
  chairmanNameKa: 'გიორგი',
  chairmanNameRu: 'Георгий',
  chairmanNameEn: 'Giorgi',
  chairmanPhone: '555 12 34 56',
  contactPersonNameKa: 'ნინო',
  contactPersonNameRu: 'Нино',
  contactPersonNameEn: 'Nino',
  contactPersonPhone: '+995 599 00 00 01',
};

describe('channel links', () => {
  it('accepts Telegram links on t.me only', () => {
    expect(telegramUrlField.parse('https://t.me/tsz_batumi')).toBe('https://t.me/tsz_batumi');
    for (const url of [
      'http://t.me/tsz',
      'https://t.me/',
      'https://evil.example/t.me/tsz',
      'https://t.me.evil.example/tsz',
      'https://user@t.me/tsz',
      'javascript:alert(1)',
    ]) {
      expect(telegramUrlField.safeParse(url).success).toBe(false);
    }
  });

  it('accepts WhatsApp channel and group invite links', () => {
    expect(whatsappUrlField.parse('https://whatsapp.com/channel/0029Va')).toBe(
      'https://whatsapp.com/channel/0029Va',
    );
    expect(whatsappUrlField.parse('https://chat.whatsapp.com/AbCdEf')).toBe(
      'https://chat.whatsapp.com/AbCdEf',
    );
    expect(whatsappUrlField.safeParse('https://whatsapp.com/other').success).toBe(false);
    expect(whatsappUrlField.safeParse('https://wa.me/995555123456').success).toBe(false);
  });

  it('stores an empty link as null', () => {
    expect(telegramUrlField.parse('  ')).toBeNull();
    expect(whatsappUrlField.parse(undefined)).toBeNull();
  });
});

describe('contactSchema', () => {
  it('normalizes phones to E.164', () => {
    const result = contactSchema.parse(contact);
    expect(result.chairmanPhone).toBe('+995555123456');
    expect(result.contactPersonPhone).toBe('+995599000001');
    expect(result.telegramUrl).toBeNull();
  });

  it('reports a foreign channel link as INVALID_URL', () => {
    const result = contactSchema.safeParse({ ...contact, telegramUrl: 'https://evil.example' });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['telegramUrl'], message: 'INVALID_URL' }),
    ]);
  });
});

describe('announcementSchema', () => {
  const announcement = {
    titleKa: 'ა',
    titleRu: 'А',
    titleEn: 'A',
    bodyKa: 'ტექსტი',
    bodyRu: 'Текст',
    bodyEn: 'Text',
    publishedAt: '2026-11-01T10:00:00.000Z',
  };

  it('requires every translation', () => {
    const result = announcementSchema.safeParse({ ...announcement, titleEn: ' ', bodyKa: '' });
    expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      ['titleEn', 'REQUIRED'],
      ['bodyKa', 'REQUIRED'],
    ]);
  });

  it('checks the publication date', () => {
    expect(announcementSchema.parse(announcement).isPinned).toBe(false);
    const result = announcementSchema.safeParse({ ...announcement, publishedAt: 'tomorrow' });
    expect(result.error?.issues[0]).toMatchObject({
      path: ['publishedAt'],
      message: 'INVALID_DATE',
    });
    expect(
      announcementSchema.safeParse({ ...announcement, publishedAt: undefined }).error?.issues[0],
    ).toMatchObject({ message: 'REQUIRED' });
  });
});

describe('documentSchema', () => {
  it('rejects an unknown visibility and a missing category', () => {
    const result = documentSchema.safeParse({
      titleKa: 'ა',
      titleRu: 'А',
      titleEn: 'A',
      visibility: 'SECRET',
    });
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'categoryId',
      'visibility',
    ]);
  });
});

describe('localized', () => {
  it('picks the translation for the locale', () => {
    const record = { titleKa: 'ა', titleRu: 'А', titleEn: 'A' };
    expect(localized(record, 'title', 'ka')).toBe('ა');
    expect(localized(record, 'title', 'en')).toBe('A');
  });
});

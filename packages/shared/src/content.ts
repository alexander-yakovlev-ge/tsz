import { z } from 'zod';
import { code, phoneField, requiredText } from './fields';
import type { Locale } from './locales';

/** Запись с переводами поля: `title` → `titleKa`, `titleRu`, `titleEn` (ТЗ п. 3.2). */
export type Localized<K extends string> = Record<`${K}${'Ka' | 'Ru' | 'En'}`, string>;

const SUFFIX = { ka: 'Ka', ru: 'Ru', en: 'En' } as const;

/** Перевод поля на нужный язык. */
export function localized<K extends string>(record: Localized<K>, key: K, locale: Locale): string {
  return record[`${key}${SUFFIX[locale]}` as keyof Localized<K>];
}

// --- Главная страница (ТЗ п. 4.16, 8.8) ---

export const homePageSchema = z.object({
  nameKa: requiredText(200),
  nameRu: requiredText(200),
  nameEn: requiredText(200),
  addressKa: requiredText(300),
  addressRu: requiredText(300),
  addressEn: requiredText(300),
  introKa: requiredText(10_000),
  introRu: requiredText(10_000),
  introEn: requiredText(10_000),
});
export type HomePageInput = z.input<typeof homePageSchema>;

export type HomePageContent = Localized<'name' | 'address' | 'intro'> & { updatedAt: string };

// --- Контакты (ТЗ п. 4.15, 6.5, 8.7) ---

/** Необязательная ссылка на канал: пустая строка → null, чужой адрес → INVALID_URL. */
function channelUrl(allowed: (url: URL) => boolean) {
  return z
    .string(code('INVALID_URL'))
    .trim()
    .max(500, code('TOO_LONG'))
    .nullish()
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }
      const url = URL.canParse(value) ? new URL(value) : null;
      if (!url || url.protocol !== 'https:' || url.username || url.port || !allowed(url)) {
        ctx.addIssue({ code: 'custom', message: code('INVALID_URL') });
        return z.NEVER;
      }
      return url.toString();
    });
}

/** Только `https://t.me/…`. */
export const telegramUrlField = channelUrl(
  (url) => url.hostname === 't.me' && /^\/[^/]+/.test(url.pathname),
);

/** Только `https://whatsapp.com/channel/…` или `https://chat.whatsapp.com/…`. */
export const whatsappUrlField = channelUrl(
  (url) =>
    ((url.hostname === 'whatsapp.com' || url.hostname === 'www.whatsapp.com') &&
      /^\/channel\/[^/]+/.test(url.pathname)) ||
    (url.hostname === 'chat.whatsapp.com' && /^\/[^/]+/.test(url.pathname)),
);

export const contactSchema = z.object({
  chairmanNameKa: requiredText(200),
  chairmanNameRu: requiredText(200),
  chairmanNameEn: requiredText(200),
  chairmanPhone: phoneField,
  contactPersonNameKa: requiredText(200),
  contactPersonNameRu: requiredText(200),
  contactPersonNameEn: requiredText(200),
  contactPersonPhone: phoneField,
  telegramUrl: telegramUrlField,
  whatsappUrl: whatsappUrlField,
});
export type ContactInput = z.input<typeof contactSchema>;

export type ContactInfo = Localized<'chairmanName' | 'contactPersonName'> & {
  chairmanPhone: string;
  contactPersonPhone: string;
  telegramUrl: string | null;
  whatsappUrl: string | null;
  updatedAt: string;
};

// --- Объявления (ТЗ п. 4.10, 6.1, 8.5) ---

export const ANNOUNCEMENTS_PAGE_SIZE = 20;

export const announcementSchema = z.object({
  titleKa: requiredText(200),
  titleRu: requiredText(200),
  titleEn: requiredText(200),
  bodyKa: requiredText(20_000),
  bodyRu: requiredText(20_000),
  bodyEn: requiredText(20_000),
  isPinned: z.boolean(code('INVALID_VALUE')).default(false),
  /** ISO-строка со смещением; форма переводит время Тбилиси (см. fromTbilisiLocal) */
  publishedAt: z
    .string(code('REQUIRED'))
    .pipe(z.iso.datetime({ offset: true, error: code('INVALID_DATE') })),
});
export type AnnouncementInput = z.input<typeof announcementSchema>;

/** Изменение: те же поля и снятие с публикации / возврат. */
export const updateAnnouncementSchema = announcementSchema.extend({
  archived: z.boolean(code('INVALID_VALUE')),
});
export type UpdateAnnouncementInput = z.input<typeof updateAnnouncementSchema>;

export const ANNOUNCEMENT_STATUSES = ['SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export type AnnouncementItem = Localized<'title' | 'body'> & {
  id: string;
  isPinned: boolean;
  publishedAt: string;
  archivedAt: string | null;
  status: AnnouncementStatus;
};

export interface AnnouncementPage {
  items: AnnouncementItem[];
  page: number;
  pageCount: number;
}

// --- Документы (ТЗ п. 4.8, 4.9, 6.3, 8.6) ---

export const DOCUMENT_VISIBILITIES = ['PUBLIC', 'OWNERS', 'PRIVATE'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

/** Максимальный размер файла — 20 МБ (ТЗ п. 8.6). Caddy пропускает чуть больше — на заголовки multipart. */
export const DOCUMENT_MAX_SIZE = 20 * 1024 * 1024;

/** Допустимые форматы (ТЗ п. 8.6). Тип определяется по содержимому файла, а не по имени. */
export const DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  png: 'image/png',
} as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const documentCategorySchema = z.object({
  nameKa: requiredText(100),
  nameRu: requiredText(100),
  nameEn: requiredText(100),
  sortOrder: z
    .number(code('INVALID_VALUE'))
    .int(code('INVALID_VALUE'))
    .min(0, code('INVALID_VALUE'))
    .max(1_000_000, code('INVALID_VALUE'))
    .default(0),
});
export type DocumentCategoryInput = z.input<typeof documentCategorySchema>;

export type DocumentCategoryItem = Localized<'name'> & {
  id: string;
  sortOrder: number;
  documentCount: number;
};

/** Поля документа: при загрузке (multipart, вместе с файлом) и при изменении без файла. */
export const documentSchema = z.object({
  titleKa: requiredText(300),
  titleRu: requiredText(300),
  titleEn: requiredText(300),
  categoryId: z.uuid(code('REQUIRED')),
  visibility: z.enum(DOCUMENT_VISIBILITIES, code('INVALID_VALUE')),
});
export type DocumentInput = z.input<typeof documentSchema>;

export type DocumentItem = Localized<'title'> & {
  id: string;
  categoryId: string;
  visibility: DocumentVisibility;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
};

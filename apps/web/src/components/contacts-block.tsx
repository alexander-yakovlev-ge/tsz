import { ContactInfo, formatPhone, localized, whatsappChatUrl } from '@tsz/shared';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s1 2.5 1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.2l-4.8-1.5c-1-.3-1-1 .2-1.5l18.9-7.3c.9-.3 1.6.2 1.4 1.4Z" />
    </svg>
  );
}

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Председатель и контактное лицо; телефоны ведут в чат WhatsApp, рядом каналы ТСЖ (ТЗ п. 6.5). */
export async function ContactsBlock({
  contacts,
  locale,
  compact = false,
}: {
  contacts: ContactInfo;
  locale: Locale;
  /** Узкая колонка (главная): люди друг под другом */
  compact?: boolean;
}) {
  const t = await getTranslations('contacts');
  const people = [
    {
      role: t('chairman'),
      name: localized(contacts, 'chairmanName', locale),
      phone: contacts.chairmanPhone,
    },
    {
      role: t('contactPerson'),
      name: localized(contacts, 'contactPersonName', locale),
      phone: contacts.contactPersonPhone,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className={`grid gap-5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {people.map((person) => {
          const chat = whatsappChatUrl(person.phone);
          return (
            <div key={person.role} className="flex flex-col gap-1">
              <dt className="text-sm font-semibold text-gray-600">{person.role}</dt>
              <dd className="text-lg font-bold">{person.name}</dd>
              <dd>
                {chat ? (
                  <a
                    href={chat}
                    {...external}
                    className="inline-flex min-h-11 items-center gap-2 font-semibold whitespace-nowrap text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <WhatsAppIcon />
                    {formatPhone(person.phone)}
                    <span className="sr-only">{t('openWhatsApp')}</span>
                  </a>
                ) : (
                  <span className="text-gray-600">{person.phone}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {(contacts.whatsappUrl || contacts.telegramUrl) && (
        <div className="flex flex-wrap gap-3">
          {contacts.whatsappUrl && (
            <a
              href={contacts.whatsappUrl}
              {...external}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1f7a4d] px-5 font-bold text-white hover:bg-[#17603c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a4d]"
            >
              <WhatsAppIcon />
              {t('whatsappChannel')}
            </a>
          )}
          {contacts.telegramUrl && (
            <a
              href={contacts.telegramUrl}
              {...external}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1d6fa5] px-5 font-bold text-white hover:bg-[#175a86] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6fa5]"
            >
              <TelegramIcon />
              {t('telegramChannel')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

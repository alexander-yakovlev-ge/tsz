/**
 * Начальные данные (ТЗ п. 4.18). Идемпотентен: запускается при каждом старте api
 * и создаёт только то, чего ещё нет. Существующие записи не изменяет.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const BCRYPT_COST = 12;
const E164 = /^\+[1-9]\d{7,14}$/;

const prisma = new PrismaClient();

async function seedAdmin(): Promise<void> {
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password) {
    throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be set');
  }
  if (!E164.test(phone)) {
    throw new Error('ADMIN_PHONE must be in E.164 format, e.g. +995555123456');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const existing = await prisma.user.findFirst({ where: { phone, deletedAt: null } });
  if (existing) {
    return;
  }
  await prisma.user.create({
    data: {
      phone,
      passwordHash: await hash(password, BCRYPT_COST),
      role: 'ADMIN',
      name: process.env.ADMIN_NAME || 'Administrator',
    },
  });
  console.log(`seed: admin ${phone} created`);
}

async function seedContact(): Promise<void> {
  if ((await prisma.contact.count()) > 0) {
    return;
  }
  await prisma.contact.create({
    data: {
      chairmanNameKa: '—',
      chairmanNameRu: '—',
      chairmanNameEn: '—',
      chairmanPhone: '—',
      contactPersonNameKa: '—',
      contactPersonNameRu: '—',
      contactPersonNameEn: '—',
      contactPersonPhone: '—',
    },
  });
  console.log('seed: contacts placeholder created');
}

async function seedHomePage(): Promise<void> {
  if ((await prisma.homePage.count()) > 0) {
    return;
  }
  await prisma.homePage.create({
    data: {
      nameKa: 'თამარ მეფის 1',
      nameRu: 'Тамар Мепе, 1',
      nameEn: 'Tamar Mepe 1',
      addressKa: 'ქ. ბათუმი, თამარ მეფის გამზირი, N 1',
      addressRu: 'г. Батуми, пр. Тамар Мепе, 1',
      addressEn: '1 Tamar Mepe Ave, Batumi',
      introKa: 'საიტი მუშავდება.',
      introRu: 'Сайт находится в разработке.',
      introEn: 'The website is under construction.',
    },
  });
  console.log('seed: home page placeholder created');
}

async function seedDocumentCategories(): Promise<void> {
  if ((await prisma.documentCategory.count()) > 0) {
    return;
  }
  await prisma.documentCategory.createMany({
    data: [
      { nameKa: 'წესდება', nameRu: 'Устав', nameEn: 'Charter', sortOrder: 10 },
      { nameKa: 'ოქმები', nameRu: 'Протоколы', nameEn: 'Minutes', sortOrder: 20 },
      { nameKa: 'ანგარიშები', nameRu: 'Отчёты', nameEn: 'Reports', sortOrder: 30 },
    ],
  });
  console.log('seed: document categories created');
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedContact();
  await seedHomePage();
  await seedDocumentCategories();
  console.log('seed: done');
}

main()
  .catch((error) => {
    console.error('seed: failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

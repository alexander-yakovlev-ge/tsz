-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RESIDENT');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ka', 'ru', 'en');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT,
    "language" "Locale" NOT NULL DEFAULT 'ka',
    "notify_announcements" BOOLEAN NOT NULL DEFAULT true,
    "notify_balance" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "announcements_seen_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "chairman_name_ka" TEXT NOT NULL,
    "chairman_name_ru" TEXT NOT NULL,
    "chairman_name_en" TEXT NOT NULL,
    "chairman_phone" TEXT NOT NULL,
    "contact_person_name_ka" TEXT NOT NULL,
    "contact_person_name_ru" TEXT NOT NULL,
    "contact_person_name_en" TEXT NOT NULL,
    "contact_person_phone" TEXT NOT NULL,
    "telegram_url" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_page" (
    "id" UUID NOT NULL,
    "name_ka" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "address_ka" TEXT NOT NULL,
    "address_ru" TEXT NOT NULL,
    "address_en" TEXT NOT NULL,
    "intro_ka" TEXT NOT NULL,
    "intro_ru" TEXT NOT NULL,
    "intro_en" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" UUID NOT NULL,
    "name_ka" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");


-- Телефон уникален только среди неудалённых пользователей (ТЗ п. 4.1).
CREATE UNIQUE INDEX "users_phone_active_key" ON "users"("phone") WHERE "deleted_at" IS NULL;

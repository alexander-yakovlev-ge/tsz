-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'OWNERS', 'PRIVATE');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "whatsapp_url" TEXT,
ALTER COLUMN "telegram_url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "title_ka" TEXT NOT NULL,
    "title_ru" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title_ka" TEXT NOT NULL,
    "title_ru" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_ka" TEXT NOT NULL,
    "body_ru" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "send_push" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_category_id_created_at_idx" ON "documents"("category_id", "created_at");

-- CreateIndex
CREATE INDEX "announcements_is_pinned_published_at_idx" ON "announcements"("is_pinned", "published_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Заглушка seed этапа 1 «https://t.me/» не проходит проверку ссылки канала (ТЗ п. 8.7).
UPDATE "contacts" SET "telegram_url" = NULL WHERE "telegram_url" = 'https://t.me/';

-- Название ТСЖ теперь заголовок главной (ТЗ п. 6.2): заглушка seed этапа 1 заменяется названием дома.
UPDATE "home_page"
SET "name_ka" = 'თამარ მეფის 1', "name_ru" = 'Тамар Мепе, 1', "name_en" = 'Tamar Mepe 1'
WHERE "name_ru" = 'ТСЖ' AND "name_en" = 'Homeowners Association';

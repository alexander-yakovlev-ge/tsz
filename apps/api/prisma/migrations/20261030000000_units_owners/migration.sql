-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('APARTMENT', 'PARKING', 'COMMERCIAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "TariffCategory" AS ENUM ('FULL', 'BLACK_FRAME', 'PENSIONER');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OwnerKind" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "UnitDocumentKind" AS ENUM ('REGISTRY_EXTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "kind" "UnitKind" NOT NULL,
    "cadastral_code" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sort_key" TEXT NOT NULL,
    "floor" INTEGER,
    "floor_label" TEXT,
    "area_m2" DECIMAL(8,2) NOT NULL,
    "tariff_category" "TariffCategory",
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" UUID NOT NULL,
    "kind" "OwnerKind" NOT NULL,
    "registry_name" TEXT NOT NULL,
    "display_name" TEXT,
    "id_numbers" TEXT[],
    "id_hashes" TEXT[],
    "user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_ownerships" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "share_num" INTEGER,
    "share_den" INTEGER,
    "share_note" TEXT,
    "is_contact" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "unit_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_documents" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "kind" "UnitDocumentKind" NOT NULL,
    "title" TEXT,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_cadastral_code_key" ON "units"("cadastral_code");

-- CreateIndex
CREATE INDEX "units_sort_key_idx" ON "units"("sort_key");

-- CreateIndex
CREATE INDEX "owners_id_hashes_idx" ON "owners" USING GIN ("id_hashes");

-- CreateIndex
CREATE INDEX "owners_user_id_idx" ON "owners"("user_id");

-- CreateIndex
CREATE INDEX "unit_ownerships_owner_id_idx" ON "unit_ownerships"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_ownerships_unit_id_owner_id_key" ON "unit_ownerships"("unit_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_documents_storage_key_key" ON "unit_documents"("storage_key");

-- CreateIndex
CREATE INDEX "unit_documents_unit_id_created_at_idx" ON "unit_documents"("unit_id", "created_at");

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_ownerships" ADD CONSTRAINT "unit_ownerships_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_ownerships" ADD CONSTRAINT "unit_ownerships_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Вручную (Prisma не поддерживает частичные индексы и CHECK).
-- Одно основное контактное лицо на помещение (ТЗ п. 4.3.1).
CREATE UNIQUE INDEX "unit_ownerships_contact_key" ON "unit_ownerships"("unit_id") WHERE "is_contact";

-- Доля: обе части или ни одной, 0 < числитель ≤ знаменатель.
ALTER TABLE "unit_ownerships" ADD CONSTRAINT "unit_ownerships_share_check" CHECK (
  ("share_num" IS NULL AND "share_den" IS NULL)
  OR ("share_num" > 0 AND "share_den" > 0 AND "share_num" <= "share_den")
);

-- Категория тарифа обязательна для квартир и пуста у остальных видов (ТЗ п. 4.2).
ALTER TABLE "units" ADD CONSTRAINT "units_tariff_category_check" CHECK (
  ("kind" = 'APARTMENT') = ("tariff_category" IS NOT NULL)
);

import { Owner, Prisma, Unit, UnitDocument, UnitOwnership, User } from '@prisma/client';
import type {
  LinkedUser,
  OwnerItem,
  OwnerUnitItem,
  Share,
  UnitDocumentItem,
  UnitItem,
  UnitOwnerItem,
} from '@tsz/shared';

/** Помещение с собственниками и их учётными записями — для списка и карточки (ТЗ п. 8.1). */
export const unitInclude = {
  ownerships: {
    include: { owner: { include: { user: true } } },
    orderBy: [{ isContact: 'desc' }, { owner: { registryName: 'asc' } }],
  },
} satisfies Prisma.UnitInclude;
export type UnitWithOwners = Prisma.UnitGetPayload<{ include: typeof unitInclude }>;

export const ownerInclude = {
  user: true,
  ownerships: { include: { unit: true }, orderBy: { unit: { sortKey: 'asc' } } },
} satisfies Prisma.OwnerInclude;
export type OwnerWithUnits = Prisma.OwnerGetPayload<{ include: typeof ownerInclude }>;

export function toShare(ownership: Pick<UnitOwnership, 'shareNum' | 'shareDen'>): Share | null {
  return ownership.shareNum && ownership.shareDen
    ? { num: ownership.shareNum, den: ownership.shareDen }
    : null;
}

/** Удалённые учётные записи отвязываются при удалении, но на всякий случай не показываются. */
export function toLinkedUser(user: User | null): LinkedUser | null {
  return user && !user.deletedAt ? { id: user.id, phone: user.phone } : null;
}

function toUnitOwner(
  ownership: UnitOwnership & { owner: Owner & { user: User | null } },
): UnitOwnerItem {
  return {
    ownershipId: ownership.id,
    ownerId: ownership.ownerId,
    ownerKind: ownership.owner.kind,
    registryName: ownership.owner.registryName,
    displayName: ownership.owner.displayName,
    share: toShare(ownership),
    shareNote: ownership.shareNote,
    isContact: ownership.isContact,
    user: toLinkedUser(ownership.owner.user),
  };
}

export function toUnitItem(unit: UnitWithOwners): UnitItem {
  const owners = unit.ownerships.map(toUnitOwner);
  return {
    id: unit.id,
    kind: unit.kind,
    cadastralCode: unit.cadastralCode,
    number: unit.number,
    floor: unit.floor,
    floorLabel: unit.floorLabel,
    areaM2: unit.areaM2.toFixed(2),
    tariffCategory: unit.tariffCategory,
    status: unit.status,
    owners,
    hasContact: owners.some((owner) => owner.user),
  };
}

function toOwnerUnit(ownership: UnitOwnership & { unit: Unit }): OwnerUnitItem {
  return {
    ownershipId: ownership.id,
    unitId: ownership.unitId,
    kind: ownership.unit.kind,
    number: ownership.unit.number,
    status: ownership.unit.status,
    share: toShare(ownership),
    shareNote: ownership.shareNote,
    isContact: ownership.isContact,
  };
}

export function toOwnerItem(owner: OwnerWithUnits): OwnerItem {
  return {
    id: owner.id,
    kind: owner.kind,
    registryName: owner.registryName,
    displayName: owner.displayName,
    units: owner.ownerships.map(toOwnerUnit),
    user: toLinkedUser(owner.user),
  };
}

export function toUnitDocumentItem(document: UnitDocument): UnitDocumentItem {
  return {
    id: document.id,
    unitId: document.unitId,
    kind: document.kind,
    title: document.title,
    originalFilename: document.originalFilename,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    createdAt: document.createdAt.toISOString(),
  };
}

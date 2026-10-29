import {
  displayUnitNumber,
  idNumbersField,
  normalizeIdNumber,
  normalizeName,
  ownershipSchema,
  parseShare,
  searchUnitNumber,
  unitSchema,
  unitSortKey,
} from './registry';

describe('unitSortKey', () => {
  it('sorts numbers naturally with Georgian suffixes after the plain number', () => {
    const numbers = ['6', '5დ', '10', '5', '5ა', '257', '5ბ', '5გ'];
    const sorted = [...numbers].sort((a, b) =>
      unitSortKey('APARTMENT', a).localeCompare(unitSortKey('APARTMENT', b)),
    );
    expect(sorted).toEqual(['5', '5ა', '5ბ', '5გ', '5დ', '6', '10', '257']);
  });

  it('groups by kind first', () => {
    expect(unitSortKey('APARTMENT', '200') < unitSortKey('PARKING', '1')).toBe(true);
    expect(unitSortKey('PARKING', '47') < unitSortKey('COMMERCIAL', '1')).toBe(true);
  });
});

describe('displayUnitNumber', () => {
  it('transliterates the Georgian letter on ru and en only', () => {
    expect(displayUnitNumber('5ა', 'ka')).toBe('5ა');
    expect(displayUnitNumber('5ა', 'ru')).toBe('5а');
    expect(displayUnitNumber('5დ', 'en')).toBe('5d');
    expect(displayUnitNumber('45', 'ru')).toBe('45');
  });

  it('maps a typed Latin or Cyrillic suffix back for search', () => {
    expect(searchUnitNumber('5а')).toBe('5ა');
    expect(searchUnitNumber('5B')).toBe('5ბ');
    expect(searchUnitNumber(' 5 g ')).toBe('5გ');
    expect(searchUnitNumber('45')).toBe('45');
    expect(searchUnitNumber('Анна')).toBe('Анна');
  });
});

describe('parseShare', () => {
  it('reduces fractions and percents', () => {
    expect(parseShare('1/2')).toEqual({ num: 1, den: 2 });
    expect(parseShare('4/6')).toEqual({ num: 2, den: 3 });
    expect(parseShare('50%')).toEqual({ num: 1, den: 2 });
    expect(parseShare('33,5 %')).toEqual({ num: 67, den: 200 });
    expect(parseShare(' 1 / 4 ')).toEqual({ num: 1, den: 4 });
  });

  it('returns undefined for empty and null for invalid', () => {
    expect(parseShare('')).toBeUndefined();
    for (const value of ['0/2', '3/2', '1/0', '150%', 'half', '1/2/3']) {
      expect(parseShare(value)).toBeNull();
    }
  });

  it('is validated by the ownership schema', () => {
    expect(ownershipSchema.parse({ share: '50%' }).share).toEqual({ num: 1, den: 2 });
    expect(ownershipSchema.parse({ share: '' }).share).toBeNull();
    expect(ownershipSchema.safeParse({ share: '2/1' }).success).toBe(false);
  });
});

describe('id numbers and names', () => {
  it('normalizes document numbers', () => {
    expect(normalizeIdNumber(' ab 12-34 567 ')).toBe('AB1234567');
    expect(idNumbersField.parse(['01001001001', '01-001-001-001', 'ab 1234567'])).toEqual([
      '01001001001',
      'AB1234567',
    ]);
    expect(idNumbersField.safeParse(['12']).success).toBe(false);
    expect(idNumbersField.safeParse(['AB/123']).success).toBe(false);
  });

  it('ignores case, spacing and quote style in names', () => {
    expect(normalizeName('შპს  "ალფა"')).toBe(normalizeName('შპს „ალფა“'));
    expect(normalizeName('  Ivan   PETROV ')).toBe('ivan petrov');
  });
});

describe('unitSchema', () => {
  const apartment = {
    kind: 'APARTMENT',
    cadastralCode: '05.30.39.005.01.01.045',
    number: '45',
    floor: 7,
    areaM2: '38,6',
    tariffCategory: 'FULL',
  } as const;

  it('normalizes area and empty optionals', () => {
    expect(unitSchema.parse({ ...apartment, floorLabel: '' })).toMatchObject({
      areaM2: '38.60',
      floorLabel: null,
    });
    expect(
      unitSchema.parse({ ...apartment, number: '5ა', cadastralCode: '05.30.39.005.01.01.005ა' })
        .number,
    ).toBe('5ა');
  });

  it('requires a tariff category for apartments only', () => {
    const missing = unitSchema.safeParse({ ...apartment, tariffCategory: null });
    expect(missing.error?.issues[0]).toMatchObject({
      path: ['tariffCategory'],
      message: 'REQUIRED',
    });
    const parking = unitSchema.safeParse({ ...apartment, kind: 'PARKING' });
    expect(parking.error?.issues[0]).toMatchObject({
      path: ['tariffCategory'],
      message: 'INVALID_VALUE',
    });
    expect(
      unitSchema.safeParse({ ...apartment, kind: 'PARKING', tariffCategory: null }).success,
    ).toBe(true);
  });

  it('rejects malformed codes, numbers and areas', () => {
    for (const patch of [
      { cadastralCode: '05.30.39.005.01.045' },
      { number: 'N45' },
      { areaM2: '0' },
      { areaM2: '12.345' },
    ]) {
      expect(unitSchema.safeParse({ ...apartment, ...patch }).success).toBe(false);
    }
  });
});

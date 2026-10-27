import { randomInt } from 'node:crypto';
import { compare, hash, hashSync } from 'bcryptjs';

/** ТЗ п. 11: bcrypt, cost ≥ 12. */
export const BCRYPT_COST = 12;

/** Без похожих символов (0/O, 1/l/I), чтобы пароль можно было продиктовать. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GENERATED_LENGTH = 12;

/** Хэш для сравнения, когда пользователь не найден: время ответа не выдаёт, есть ли такой номер. */
const DUMMY_HASH = hashSync('dummy-password-for-timing', BCRYPT_COST);

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string | null): Promise<boolean> {
  return compare(password, passwordHash ?? DUMMY_HASH).then((ok) => ok && passwordHash !== null);
}

export function generatePassword(): string {
  let result = '';
  for (let i = 0; i < GENERATED_LENGTH; i++) {
    result += ALPHABET[randomInt(ALPHABET.length)];
  }
  return result;
}

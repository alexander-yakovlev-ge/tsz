import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env';

const FORMAT = 'v1';

function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'tsz-owner-id-numbers', purpose, 32));
}

/**
 * Номера документов собственников (ТЗ п. 4.3): каждый номер шифруется AES-256-GCM,
 * а для поиска совпадений хранится HMAC-SHA256 нормализованного номера.
 */
@Injectable()
export class OwnerIdsService {
  private readonly encryptionKey: Buffer;
  private readonly hashKey: Buffer;

  constructor() {
    this.encryptionKey = deriveKey(env.idNumbersKey, 'encryption');
    this.hashKey = deriveKey(env.idNumbersKey, 'hmac');
  }

  /** Номера уже нормализованы (normalizeIdNumber) — иначе HMAC не совпадёт. */
  seal(numbers: string[]): { idNumbers: string[]; idHashes: string[] } {
    return {
      idNumbers: numbers.map((n) => this.encrypt(n)),
      idHashes: numbers.map((n) => this.hash(n)),
    };
  }

  open(sealed: string[]): string[] {
    return sealed.map((value) => this.decrypt(value));
  }

  hash(number: string): string {
    return createHmac('sha256', this.hashKey).update(number).digest('base64url');
  }

  private encrypt(number: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const data = Buffer.concat([cipher.update(number, 'utf8'), cipher.final()]);
    return [FORMAT, iv, data, cipher.getAuthTag()]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  private decrypt(value: string): string {
    const [format, iv, data, tag] = value.split('.');
    if (format !== FORMAT || !iv || !data || !tag) {
      throw new Error('Unsupported encrypted id number format');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

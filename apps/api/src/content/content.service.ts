import { HttpStatus, Injectable } from '@nestjs/common';
import { Contact, HomePage } from '@prisma/client';
import { z } from 'zod';
import {
  ContactInfo,
  contactSchema,
  HomePageContent,
  homePageSchema,
  SessionUser,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

type HomePageUpdate = z.output<typeof homePageSchema>;
type ContactUpdate = z.output<typeof contactSchema>;

function toHomePage({
  id: _id,
  updatedBy: _updatedBy,
  updatedAt,
  ...fields
}: HomePage): HomePageContent {
  return { ...fields, updatedAt: updatedAt.toISOString() };
}

function toContact({ id: _id, updatedAt, ...fields }: Contact): ContactInfo {
  return { ...fields, updatedAt: updatedAt.toISOString() };
}

/** Имена изменённых полей — для AuditLog без длинных текстов. */
function changedFields<T extends object>(current: T, input: Partial<T>): string[] {
  return Object.entries(input)
    .filter(([key, value]) => current[key as keyof T] !== value)
    .map(([key]) => key);
}

/** Главная страница и контакты — записи-одиночки, создаются seed'ом (ТЗ п. 4.15, 4.16). */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getHomePage(): Promise<HomePageContent> {
    return toHomePage(await this.findHomePage());
  }

  async updateHomePage(
    actor: SessionUser,
    input: HomePageUpdate,
    ip?: string,
  ): Promise<HomePageContent> {
    const current = await this.findHomePage();
    const fields = changedFields(current, input);
    const page = await this.prisma.homePage.update({
      where: { id: current.id },
      data: { ...input, updatedBy: actor.id },
    });
    if (fields.length > 0) {
      await this.audit.log({ userId: actor.id, action: 'home.update', payload: { fields }, ip });
    }
    return toHomePage(page);
  }

  async getContacts(): Promise<ContactInfo> {
    return toContact(await this.findContact());
  }

  async updateContacts(
    actor: SessionUser,
    input: ContactUpdate,
    ip?: string,
  ): Promise<ContactInfo> {
    const current = await this.findContact();
    const fields = changedFields(current, input);
    const contact = await this.prisma.contact.update({ where: { id: current.id }, data: input });
    if (fields.length > 0) {
      await this.audit.log({
        userId: actor.id,
        action: 'contacts.update',
        payload: { fields },
        ip,
      });
    }
    return toContact(contact);
  }

  private async findHomePage(): Promise<HomePage> {
    const page = await this.prisma.homePage.findFirst({ orderBy: { updatedAt: 'asc' } });
    if (!page) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return page;
  }

  private async findContact(): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({ orderBy: { updatedAt: 'asc' } });
    if (!contact) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return contact;
  }
}

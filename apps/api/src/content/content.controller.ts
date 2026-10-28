import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import {
  ContactInfo,
  contactSchema,
  HomePageContent,
  homePageSchema,
  SessionUser,
} from '@tsz/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ContentService } from './content.service';

/** Главная страница и контакты (ТЗ п. 6.2, 6.5, 8.7, 8.8). */
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('home')
  @Public()
  async getHomePage(): Promise<{ home: HomePageContent }> {
    return { home: await this.content.getHomePage() };
  }

  @Put('home')
  @Roles('ADMIN')
  async updateHomePage(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(homePageSchema)) body: z.output<typeof homePageSchema>,
    @Req() req: Request,
  ): Promise<{ home: HomePageContent }> {
    return { home: await this.content.updateHomePage(actor, body, req.ip) };
  }

  @Get('contacts')
  @Public()
  async getContacts(): Promise<{ contacts: ContactInfo }> {
    return { contacts: await this.content.getContacts() };
  }

  @Put('contacts')
  @Roles('ADMIN')
  async updateContacts(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(contactSchema)) body: z.output<typeof contactSchema>,
    @Req() req: Request,
  ): Promise<{ contacts: ContactInfo }> {
    return { contacts: await this.content.updateContacts(actor, body, req.ip) };
  }
}

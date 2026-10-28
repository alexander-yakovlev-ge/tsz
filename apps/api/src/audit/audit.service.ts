import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  /** Кто выполнил операцию; null — система или неизвестный пользователь */
  userId: string | null;
  /** Например: auth.login, user.reset_password */
  action: string;
  entity?: string;
  entityId?: string;
  /** Параметры операции без паролей и кодов */
  payload?: Prisma.InputJsonValue;
  ip?: string;
}

/** Запись в AuditLog (ТЗ п. 4.17, 12). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (error) {
      // Сбой журнала не должен ломать саму операцию; ошибка видна в логах контейнера.
      this.logger.error(`Failed to write audit log ${entry.action}`, error as Error);
    }
  }
}

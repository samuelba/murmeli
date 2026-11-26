import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { errorMessage } from '../../common/errors/error-message';
import {
  type Page,
  type PaginationQuery,
  pageWindow,
  toPage,
} from '../../common/pagination/pagination';
import { AuditLogEntity } from './audit-log.entity';
import type { AuditAction, AuditEvent, AuditMeta } from './audit.types';
import { truncateIp } from './truncate-ip';

export interface AuditEntryView {
  readonly id: string;
  readonly at: string;
  readonly actorId: string | null;
  readonly action: AuditAction;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly ip: string | null;
  readonly meta: AuditMeta | null;
}

export function toAuditEntryView(entry: AuditLogEntity): AuditEntryView {
  return {
    id: entry.id,
    at: entry.at.toISOString(),
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ip: entry.ip,
    meta: entry.meta,
  };
}

/**
 * Writes the audit log. Entries never contain kid nicknames, passwords,
 * tokens or full IP addresses. A failed write is logged and never breaks the
 * action being audited.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.repository.insert({
        action: event.action,
        actorId: event.actorId ?? null,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        ip: truncateIp(event.ip),
        meta: event.meta ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Could not write audit entry ${event.action}: ${errorMessage(error)}`,
      );
    }
  }

  async list(
    query: PaginationQuery & { action?: AuditAction },
  ): Promise<Page<AuditEntryView>> {
    const window = pageWindow(query);
    const [entries, total] = await this.repository.findAndCount({
      where: query.action ? { action: query.action } : {},
      order: { at: 'DESC', id: 'DESC' },
      skip: window.skip,
      take: window.pageSize,
    });
    return toPage(entries.map(toAuditEntryView), total, window);
  }
}

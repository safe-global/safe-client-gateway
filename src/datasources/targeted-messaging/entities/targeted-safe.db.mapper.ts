import { TargetedSafe as DbTargetedSafe } from '@/datasources/targeted-messaging/entities/targeted-safe.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TargetedSafeDbMapper {
  map(dbTargetedSafe: DbTargetedSafe): TargetedSafe {
    return {
      id: dbTargetedSafe.id,
      address: dbTargetedSafe.address,
      outreachId: dbTargetedSafe.outreach_id,
      created_at: this.parseDate(dbTargetedSafe.created_at),
      updated_at: this.parseDate(dbTargetedSafe.updated_at),
    };
  }

  private parseDate(date: Date | string): Date {
    return date instanceof Date ? date : new Date(date);
  }
}

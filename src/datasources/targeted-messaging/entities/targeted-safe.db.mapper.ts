import { convertToDate } from '@/datasources/common/utils';
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
      created_at: convertToDate(dbTargetedSafe.created_at),
      updated_at: convertToDate(dbTargetedSafe.updated_at),
    };
  }
}

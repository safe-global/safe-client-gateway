import { convertToDate } from '@/datasources/common/utils';
import { TargetedSafe as DbTargetedSafe } from '@/modules/targeted-messaging/datasources/entities/targeted-safe.entity';
import { type TargetedSafe } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TargetedSafeDbMapper {
  map(dbTargetedSafe: DbTargetedSafe): TargetedSafe {
    return {
      id: dbTargetedSafe.id,
      address: dbTargetedSafe.address,
      outreachId: dbTargetedSafe.outreach_id,
      chainId: dbTargetedSafe.chain_id,
      created_at: convertToDate(dbTargetedSafe.created_at),
      updated_at: convertToDate(dbTargetedSafe.updated_at),
    };
  }
}

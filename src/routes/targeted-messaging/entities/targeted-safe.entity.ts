import { ApiProperty } from '@nestjs/swagger';
import type { TargetedSafe as DomainTargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';

export class TargetedSafe
  implements Pick<DomainTargetedSafe, 'outreachId' | 'address'>
{
  @ApiProperty({ type: Number })
  outreachId!: DomainTargetedSafe['outreachId'];

  @ApiProperty({ type: String })
  address!: DomainTargetedSafe['address'];
}

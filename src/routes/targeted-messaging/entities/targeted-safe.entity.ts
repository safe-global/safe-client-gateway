import { ApiProperty } from '@nestjs/swagger';
import type { TargetedSafe as DomainTargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';

export class TargetedSafe
  implements Pick<DomainTargetedSafe, 'outreachId' | 'address'>
{
  @ApiProperty()
  outreachId: number;

  @ApiProperty()
  address: `0x${string}`;

  constructor({
    outreachId,
    address,
  }: Pick<DomainTargetedSafe, 'outreachId' | 'address'>) {
    this.outreachId = outreachId;
    this.address = address;
  }
}

import { Holder as DomainHolder } from '@/domain/locking/entities/holder.entity';
import { ApiProperty } from '@nestjs/swagger';

export class Holder implements DomainHolder {
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  boost!: string;
  @ApiProperty()
  points!: string;
  @ApiProperty()
  boostedPoints!: string;
}

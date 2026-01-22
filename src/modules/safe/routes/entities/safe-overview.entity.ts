import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SafeOverview {
  @ApiProperty()
  readonly address: AddressInfo;
  @ApiProperty()
  readonly chainId: string;
  @ApiProperty()
  readonly threshold: number;
  @ApiProperty({ type: AddressInfo, isArray: true })
  readonly owners: Array<AddressInfo>;
  @ApiProperty()
  readonly fiatTotal: string;
  @ApiProperty()
  readonly queued: number;
  @ApiPropertyOptional({ type: Number, nullable: true })
  readonly awaitingConfirmation: number | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  readonly creator: AddressInfo | null;

  constructor(
    address: AddressInfo,
    chainId: string,
    threshold: number,
    owners: Array<AddressInfo>,
    fiatTotal: string,
    queued: number,
    awaitingConfirmation: number | null,
    creator: AddressInfo | null,
  ) {
    this.address = address;
    this.chainId = chainId;
    this.threshold = threshold;
    this.owners = owners;
    this.fiatTotal = fiatTotal;
    this.queued = queued;
    this.awaitingConfirmation = awaitingConfirmation;
    this.creator = creator;
  }
}

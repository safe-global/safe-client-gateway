import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

export enum MasterCopyVersionState {
  UP_TO_DATE = 'UP_TO_DATE',
  OUTDATED = 'OUTDATED',
  UNKNOWN = 'UNKNOWN',
}

export class SafeState {
  @ApiProperty()
  readonly address: AddressInfo;
  @ApiProperty()
  readonly chainId: string;
  @ApiProperty()
  readonly nonce: number;
  @ApiProperty()
  readonly threshold: number;
  @ApiProperty()
  readonly owners: AddressInfo[];
  @ApiProperty()
  readonly implementation: AddressInfo;
  @ApiPropertyOptional({ type: AddressInfo, isArray: true, nullable: true })
  readonly modules: AddressInfo[] | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  readonly fallbackHandler: AddressInfo | null;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  readonly guard: AddressInfo | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly version: string | null;
  @ApiProperty({ enum: Object.values(MasterCopyVersionState) })
  readonly implementationVersionState: MasterCopyVersionState;
  @ApiProperty()
  readonly collectiblesTag: string | null;
  @ApiProperty()
  readonly txQueuedTag: string | null;
  @ApiProperty()
  readonly txHistoryTag: string | null;
  @ApiProperty()
  readonly messagesTag: string | null;

  constructor(
    address: AddressInfo,
    chainId: string,
    nonce: number,
    threshold: number,
    owners: AddressInfo[],
    implementation: AddressInfo,
    implementationVersionState: MasterCopyVersionState,
    collectiblesTag: string | null,
    txQueuedTag: string | null,
    txHistoryTag: string | null,
    messagesTag: string | null,
    modules: AddressInfo[] | null,
    fallbackHandler: AddressInfo | null,
    guard: AddressInfo | null,
    version: string | null,
  ) {
    this.address = address;
    this.chainId = chainId;
    this.nonce = nonce;
    this.threshold = threshold;
    this.owners = owners;
    this.implementation = implementation;
    this.implementationVersionState = implementationVersionState;
    this.collectiblesTag = collectiblesTag;
    this.txQueuedTag = txQueuedTag;
    this.txHistoryTag = txHistoryTag;
    this.messagesTag = messagesTag;
    this.modules = modules;
    this.fallbackHandler = fallbackHandler;
    this.guard = guard;
    this.version = version;
  }
}

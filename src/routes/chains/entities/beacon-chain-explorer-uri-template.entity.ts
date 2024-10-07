import { ApiProperty } from '@nestjs/swagger';
import { BeaconChainExplorerUriTemplate as DomainBeaconChainExplorerUriTemplate } from '@/domain/chains/entities/beacon-chain-explorer-uri-template.entity';

export class BeaconChainExplorerUriTemplate
  implements DomainBeaconChainExplorerUriTemplate
{
  @ApiProperty({ type: String, nullable: true })
  publicKey!: string | null;
}

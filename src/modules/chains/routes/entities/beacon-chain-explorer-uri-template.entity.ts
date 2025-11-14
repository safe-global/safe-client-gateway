import { ApiProperty } from '@nestjs/swagger';
import { BeaconChainExplorerUriTemplate as DomainBeaconChainExplorerUriTemplate } from '@/modules/chains/domain/entities/beacon-chain-explorer-uri-template.entity';

export class BeaconChainExplorerUriTemplate
  implements DomainBeaconChainExplorerUriTemplate
{
  @ApiProperty({ type: String, nullable: true })
  publicKey!: string | null;
}

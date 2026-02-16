import { ApiProperty } from '@nestjs/swagger';
import { type BlockExplorerUriTemplate as DomainBlockExplorerUriTemplate } from '@/modules/chains/domain/entities/block-explorer-uri-template.entity';

export class BlockExplorerUriTemplate implements DomainBlockExplorerUriTemplate {
  @ApiProperty()
  address!: string;
  @ApiProperty()
  api!: string;
  @ApiProperty()
  txHash!: string;
}

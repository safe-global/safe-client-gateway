import { Page as DomainPage } from '../../../common/entities/page.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Chain as ApiChain } from './api-chain';

export class Page implements DomainPage<ApiChain> {
  @ApiProperty()
  count: number;
  @ApiProperty()
  next: string;
  @ApiProperty()
  previous: string;
  @ApiProperty({
    type: ApiChain,
  })
  results: ApiChain[];
}

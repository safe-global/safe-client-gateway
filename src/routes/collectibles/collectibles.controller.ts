import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CollectiblesService } from '@/routes/collectibles/collectibles.service';
import { Collectible } from '@/routes/collectibles/entities/collectible.entity';
import { CollectiblePage } from '@/routes/collectibles/entities/collectible.page.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('collectibles')
@Controller({
  version: '2',
})
export class CollectiblesController {
  constructor(private readonly service: CollectiblesService) {}

  @ApiOkResponse({ type: CollectiblePage })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'exclude_spam',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Get('chains/:chainId/safes/:safeAddress/collectibles')
  async getCollectibles(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
  ): Promise<Page<Collectible>> {
    return this.service.getCollectibles({
      chainId,
      safeAddress,
      routeUrl,
      paginationData,
      trusted,
      excludeSpam,
    });
  }
}

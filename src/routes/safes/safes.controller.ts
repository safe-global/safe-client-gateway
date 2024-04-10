import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { SafeState } from '@/routes/safes/entities/safe-info.entity';
import { SafesService } from '@/routes/safes/safes.service';
import { SafeNonces } from '@/routes/safes/entities/nonces.entity';
import { SafeOverview } from '@/routes/safes/entities/safe-overview.entity';
import { Caip10AddressesPipe } from '@/routes/safes/pipes/caip-10-addresses.pipe';

@ApiTags('safes')
@Controller({
  version: '1',
})
export class SafesController {
  constructor(private readonly service: SafesService) {}

  @ApiOkResponse({ type: SafeState })
  @Get('chains/:chainId/safes/:safeAddress')
  async getSafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<SafeState> {
    return this.service.getSafeInfo({ chainId, safeAddress });
  }

  @ApiOkResponse({ type: SafeNonces })
  @Get('chains/:chainId/safes/:safeAddress/nonces')
  async getNonces(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<SafeNonces> {
    return this.service.getNonces({ chainId, safeAddress });
  }

  @ApiQuery({ name: 'wallet_address', required: false })
  @Get('safes')
  async getSafeOverview(
    @Query('currency') currency: string,
    @Query('safes', new Caip10AddressesPipe())
    addresses: Array<{ chainId: string; address: string }>,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
    @Query('wallet_address')
    walletAddress?: string,
  ): Promise<Array<SafeOverview>> {
    return this.service.getSafeOverview({
      currency,
      addresses,
      trusted,
      excludeSpam,
      walletAddress,
    });
  }
}

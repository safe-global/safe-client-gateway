import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { Balances } from './entities/balances.entity';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('balances')
@Controller({
  path: '',
  version: '1',
})
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @ApiOkResponse({ type: Balances })
  @Get('chains/:chainId/safes/:safeAddress/balances/:fiatCode')
  async getBalances(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Param('fiatCode') fiatCode: string,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
  ): Promise<Balances> {
    return this.balancesService.getBalances({
      chainId,
      safeAddress,
      fiatCode,
      trusted,
      excludeSpam,
    });
  }

  @Get('balances/supported-fiat-codes')
  async getSupportedFiatCodes(): Promise<string[]> {
    return this.balancesService.getSupportedFiatCodes();
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Page } from '../common/entities/page.entity';
import { MultisigTransactionPage } from './entities/multisig-transaction-page.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller({
  path: '',
  version: '1',
})
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOkResponse({ type: MultisigTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/multisig-transactions')
  @ApiQuery({ name: 'executionDateGte', required: false })
  @ApiQuery({ name: 'executionDateLte', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'value', required: false })
  @ApiQuery({ name: 'nonce', required: false })
  @ApiQuery({ name: 'executed', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getTransactions(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Query('executionDateGte') executionDateGte?: string,
    @Query('executionDateLte') executionDateLte?: string,
    @Query('to') to?: string,
    @Query('value') value?: string,
    @Query('nonce') nonce?: string,
    @Query('executed') executed?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    return this.transactionsService.getMultiSigTransactions(
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      nonce,
      executed,
      limit,
      offset,
    );
  }
}

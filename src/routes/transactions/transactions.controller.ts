import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { Page } from '../common/entities/page.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { ModuleTransactionPage } from './entities/module-transaction-page.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
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
  @ApiQuery({ name: 'execution_date__gte', required: false })
  @ApiQuery({ name: 'execution_date__lte', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'value', required: false })
  @ApiQuery({ name: 'nonce', required: false })
  @ApiQuery({ name: 'executed', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async getMultisigTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to') to?: string,
    @Query('value') value?: string,
    @Query('nonce') nonce?: string,
    @Query('executed') executed?: boolean,
    @PaginationDataDecorator() paginationData?: PaginationData,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    return this.transactionsService.getMultisigTransactions(
      chainId,
      routeUrl,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      nonce,
      executed,
      paginationData,
    );
  }

  @ApiOkResponse({ type: ModuleTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/module-transactions')
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async getModuleTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @Query('to') to?: string,
    @Query('module') module?: string,
    @PaginationDataDecorator() paginationData?: PaginationData,
  ): Promise<Page<ModuleTransaction>> {
    return this.transactionsService.getModuleTransactions(
      chainId,
      routeUrl,
      safeAddress,
      to,
      module,
      paginationData,
    );
  }
}

import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDataDecorator } from '../common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '../common/decorators/route.url.decorator';
import { Page } from '../common/entities/page.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { IncomingTransferPage } from './entities/incoming-transfer-page.entity';
import { IncomingTransfer } from './entities/incoming-transfer.entity';
import { ModuleTransactionPage } from './entities/module-transaction-page.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { MultisigTransactionPage } from './entities/multisig-transaction-page.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { PreviewTransactionDto } from './entities/preview-transaction.dto.entity';
import { QueuedItemPage } from './entities/queued-item-page.entity';
import { QueuedItem } from './entities/queued-item.entity';
import { TransactionItemPage } from './entities/transaction-item-page.entity';
import { TransactionPreview } from './entities/transaction-preview.entity';
import { PreviewTransactionDtoValidationPipe } from './pipes/preview-transaction.validation.pipe';
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
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress') safeAddress: string,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to') to?: string,
    @Query('value') value?: string,
    @Query('nonce') nonce?: string,
    @Query('executed') executed?: boolean,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    return this.transactionsService.getMultisigTransactions(
      chainId,
      routeUrl,
      paginationData,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      nonce,
      executed,
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
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress') safeAddress: string,
    @Query('to') to?: string,
    @Query('module') module?: string,
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

  @ApiOkResponse({ type: IncomingTransferPage })
  @Get('chains/:chainId/safes/:safeAddress/incoming-transfers')
  @ApiQuery({ name: 'execution_date__gte', required: false })
  @ApiQuery({ name: 'execution_date__lte', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'value', required: false })
  @ApiQuery({ name: 'token_address', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async getIncomingTransfers(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to') to?: string,
    @Query('value') value?: string,
    @Query('token_address') tokenAddress?: string,
  ): Promise<Partial<Page<IncomingTransfer>>> {
    return this.transactionsService.getIncomingTransfers(
      chainId,
      routeUrl,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      tokenAddress,
      paginationData,
    );
  }

  @ApiOkResponse({ type: TransactionPreview })
  @HttpCode(200)
  @Post('chains/:chainId/transactions/:safeAddress/preview')
  async previewTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(PreviewTransactionDtoValidationPipe)
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    return this.transactionsService.previewTransaction(
      chainId,
      safeAddress,
      previewTransactionDto,
    );
  }

  @ApiOkResponse({ type: QueuedItemPage })
  @Get('chains/:chainId/safes/:safeAddress/transactions/queued')
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'timezone_offset', required: false })
  @ApiQuery({ name: 'trusted', required: false })
  async getTransactionQueue(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Partial<Page<QueuedItem>>> {
    return this.transactionsService.getTransactionQueue(
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
    );
  }

  @ApiOkResponse({ type: TransactionItemPage })
  @Get('chains/:chainId/safes/:safeAddress/transactions/history')
  @ApiQuery({ name: 'timezone_offset', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async getTransactionsHistory(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('timezone_offset', new DefaultValuePipe(0), ParseIntPipe)
    timezoneOffset: number,
  ): Promise<Partial<TransactionItemPage>> {
    return this.transactionsService.getTransactionHistory(
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
      timezoneOffset,
    );
  }
}

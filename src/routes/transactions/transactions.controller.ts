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
import { AddConfirmationDto } from './entities/add-confirmation.dto';
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
import { ProposeTransactionDto } from './entities/propose-transaction.dto.entity';
import { ProposeTransactionDtoValidationPipe } from './pipes/propose-transaction.dto.validation.pipe';
import { AddConfirmationDtoValidationPipe } from './pipes/add-confirmation.validation.pipe';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { TransactionDetails } from './entities/transaction-details/transaction-details.entity';

@ApiTags('transactions')
@Controller({
  path: '',
  version: '1',
})
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOkResponse({ type: TransactionDetails })
  @Get(`chains/:chainId/transactions/:id`)
  async getTransactionById(
    @Param('chainId') chainId: string,
    @Param('id') id: string,
  ): Promise<TransactionDetails> {
    return this.transactionsService.getById(chainId, id);
  }

  @ApiOkResponse({ type: MultisigTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/multisig-transactions')
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value', required: false, type: String })
  @ApiQuery({ name: 'nonce', required: false, type: String })
  @ApiQuery({ name: 'executed', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
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
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
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

  @HttpCode(200)
  @ApiOkResponse({ type: Transaction })
  @Post('chains/:chainId/transactions/:safeTxHash/confirmations')
  async addConfirmation(
    @Param('chainId') chainId: string,
    @Param('safeTxHash') safeTxHash: string,
    @Body(AddConfirmationDtoValidationPipe)
    addConfirmationDto: AddConfirmationDto,
  ): Promise<Transaction> {
    return this.transactionsService.addConfirmation(
      chainId,
      safeTxHash,
      addConfirmationDto,
    );
  }

  @ApiOkResponse({ type: IncomingTransferPage })
  @Get('chains/:chainId/safes/:safeAddress/incoming-transfers')
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value', required: false, type: String })
  @ApiQuery({ name: 'token_address', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
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
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'timezone_offset', required: false, type: String })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
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
  @ApiQuery({ name: 'timezone_offset', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
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

  @HttpCode(200)
  @ApiOkResponse({ type: Transaction })
  @Post('chains/:chainId/transactions/:safeAddress/propose')
  async proposeTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(ProposeTransactionDtoValidationPipe)
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.proposeTransaction(
      chainId,
      safeAddress,
      proposeTransactionDto,
    );
  }
}

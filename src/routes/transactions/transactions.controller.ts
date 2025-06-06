import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { AddConfirmationDto } from '@/routes/transactions/entities/add-confirmation.dto';
import { IncomingTransferPage } from '@/routes/transactions/entities/incoming-transfer-page.entity';
import { IncomingTransfer } from '@/routes/transactions/entities/incoming-transfer.entity';
import { ModuleTransactionPage } from '@/routes/transactions/entities/module-transaction-page.entity';
import { ModuleTransaction } from '@/routes/transactions/entities/module-transaction.entity';
import { MultisigTransactionPage } from '@/routes/transactions/entities/multisig-transaction-page.entity';
import { MultisigTransaction } from '@/routes/transactions/entities/multisig-transaction.entity';
import { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';
import { ProposeTransactionDto } from '@/routes/transactions/entities/propose-transaction.dto.entity';
import { QueuedItemPage } from '@/routes/transactions/entities/queued-item-page.entity';
import { QueuedItem } from '@/routes/transactions/entities/queued-item.entity';
import { TransactionDetails } from '@/routes/transactions/entities/transaction-details/transaction-details.entity';
import { TransactionItemPage } from '@/routes/transactions/entities/transaction-item-page.entity';
import { TransactionPreview } from '@/routes/transactions/entities/transaction-preview.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { AddConfirmationDtoSchema } from '@/routes/transactions/entities/schemas/add-confirmation.dto.schema';
import { PreviewTransactionDtoSchema } from '@/routes/transactions/entities/schemas/preview-transaction.dto.schema';
import { ProposeTransactionDtoSchema } from '@/routes/transactions/entities/schemas/propose-transaction.dto.schema';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { DeleteTransactionDtoSchema } from '@/routes/transactions/entities/schemas/delete-transaction.dto.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { CreationTransaction } from '@/routes/transactions/entities/creation-transaction.entity';
import { TimezoneSchema } from '@/validation/entities/schemas/timezone.schema';
import { TXSMultisigTransaction } from '@/routes/transactions/entities/txs-multisig-transaction.entity';
import { TXSMultisigTransactionPage } from '@/routes/transactions/entities/txs-multisig-transaction-page.entity';
import { TXSCreationTransaction } from '@/routes/transactions/entities/txs-creation-transaction.entity';

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
    return this.transactionsService.getById({
      chainId,
      txId: id,
    });
  }

  @ApiOkResponse({ type: TXSMultisigTransaction })
  @ApiOperation({ deprecated: true, summary: 'Deprecated' })
  @Get('chains/:chainId/multisig-transactions/:safeTxHash/raw')
  async getDomainMultisigTransactionBySafeTxHash(
    @Param('chainId') chainId: string,
    @Param('safeTxHash') safeTxHash: string,
  ): Promise<TXSMultisigTransaction> {
    return this.transactionsService.getDomainMultisigTransactionBySafeTxHash({
      chainId,
      safeTxHash,
    });
  }

  @ApiOkResponse({ type: TXSMultisigTransactionPage })
  @ApiQuery({ name: 'failed', required: false, type: Boolean })
  @ApiQuery({ name: 'modified__lt', required: false, type: String })
  @ApiQuery({ name: 'modified__gt', required: false, type: String })
  @ApiQuery({ name: 'modified__lte', required: false, type: String })
  @ApiQuery({ name: 'modified__gte', required: false, type: String })
  @ApiQuery({ name: 'nonce__lt', required: false, type: Number })
  @ApiQuery({ name: 'nonce__gt', required: false, type: Number })
  @ApiQuery({ name: 'nonce__lte', required: false, type: Number })
  @ApiQuery({ name: 'nonce__gte', required: false, type: Number })
  @ApiQuery({ name: 'nonce', required: false, type: Number })
  @ApiQuery({ name: 'safe_tx_hash', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value__lt', required: false, type: Number })
  @ApiQuery({ name: 'value__gt', required: false, type: Number })
  @ApiQuery({ name: 'value', required: false, type: Number })
  @ApiQuery({ name: 'executed', required: false, type: Boolean })
  @ApiQuery({ name: 'has_confirmations', required: false, type: Boolean })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'submission_date__gte', required: false, type: String })
  @ApiQuery({ name: 'submission_date__lte', required: false, type: String })
  @ApiQuery({ name: 'transaction_hash', required: false, type: String })
  @ApiQuery({ name: 'ordering', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOperation({ deprecated: true, summary: 'Deprecated' })
  @Get('chains/:chainId/safes/:safeAddress/multisig-transactions/raw')
  async getDomainMultisigTransactions(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('failed', new ParseBoolPipe({ optional: true })) failed?: boolean,
    @Query('modified__lt') modified__lt?: string,
    @Query('modified__gt') modified__gt?: string,
    @Query('modified__lte') modified__lte?: string,
    @Query('modified__gte') modified__gte?: string,
    @Query('nonce__lt', new ParseIntPipe({ optional: true }))
    nonce__lt?: number,
    @Query('nonce__gt', new ParseIntPipe({ optional: true }))
    nonce__gt?: number,
    @Query('nonce__lte', new ParseIntPipe({ optional: true }))
    nonce__lte?: number,
    @Query('nonce__gte', new ParseIntPipe({ optional: true }))
    nonce__gte?: number,
    @Query('nonce', new ParseIntPipe({ optional: true })) nonce?: number,
    @Query('safe_tx_hash') safe_tx_hash?: string,
    @Query('to') to?: string,
    @Query('value__lt', new ParseIntPipe({ optional: true }))
    value__lt?: number,
    @Query('value__gt', new ParseIntPipe({ optional: true }))
    value__gt?: number,
    @Query('value', new ParseIntPipe({ optional: true })) value?: number,
    @Query('executed', new ParseBoolPipe({ optional: true }))
    executed?: boolean,
    @Query('has_confirmations', new ParseBoolPipe({ optional: true }))
    has_confirmations?: boolean,
    @Query('trusted', new ParseBoolPipe({ optional: true })) trusted?: boolean,
    @Query('execution_date__gte') execution_date__gte?: string,
    @Query('execution_date__lte') execution_date__lte?: string,
    @Query('submission_date__gte') submission_date__gte?: string,
    @Query('submission_date__lte') submission_date__lte?: string,
    @Query('transaction_hash') transaction_hash?: string,
    @Query('ordering') ordering?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<TXSMultisigTransactionPage> {
    return this.transactionsService.getDomainMultisigTransactions({
      chainId,
      safeAddress,
      failed,
      modified__lt,
      modified__gt,
      modified__lte,
      modified__gte,
      nonce__lt,
      nonce__gt,
      nonce__lte,
      nonce__gte,
      nonce,
      safe_tx_hash,
      to,
      value__lt,
      value__gt,
      value,
      executed,
      has_confirmations,
      trusted,
      execution_date__gte,
      execution_date__lte,
      submission_date__gte,
      submission_date__lte,
      transaction_hash,
      ordering,
      limit,
      offset,
    });
  }

  @ApiOkResponse({ type: MultisigTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/multisig-transactions')
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value', required: false, type: String })
  @ApiQuery({ name: 'nonce', required: false, type: String })
  @ApiQuery({ name: 'executed', required: false, type: Boolean })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getMultisigTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to', new ValidationPipe(AddressSchema.optional()))
    to?: `0x${string}`,
    @Query('value') value?: string,
    @Query('nonce') nonce?: string,
    @Query('executed', new ParseBoolPipe({ optional: true }))
    executed?: boolean,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    return this.transactionsService.getMultisigTransactions({
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
    });
  }

  @Delete('chains/:chainId/transactions/:safeTxHash')
  async deleteTransaction(
    @Param('chainId') chainId: string,
    @Param('safeTxHash') safeTxHash: string,
    @Body(new ValidationPipe(DeleteTransactionDtoSchema))
    deleteTransactionDto: DeleteTransactionDto,
  ): Promise<void> {
    return this.transactionsService.deleteTransaction({
      chainId,
      safeTxHash,
      signature: deleteTransactionDto.signature,
    });
  }

  @ApiOkResponse({ type: ModuleTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/module-transactions')
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'transaction_hash', required: false, type: String })
  async getModuleTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Query('to') to?: string,
    @Query('module') module?: string,
    @Query('transaction_hash') txHash?: string,
  ): Promise<Page<ModuleTransaction>> {
    return this.transactionsService.getModuleTransactions({
      chainId,
      routeUrl,
      safeAddress,
      to,
      txHash,
      module,
      paginationData,
    });
  }

  @HttpCode(200)
  @ApiOkResponse({ type: Transaction })
  @Post('chains/:chainId/transactions/:safeTxHash/confirmations')
  async addConfirmation(
    @Param('chainId') chainId: string,
    @Param('safeTxHash') safeTxHash: string,
    @Body(new ValidationPipe(AddConfirmationDtoSchema))
    addConfirmationDto: AddConfirmationDto,
  ): Promise<TransactionDetails> {
    return this.transactionsService.addConfirmation({
      chainId,
      safeTxHash,
      addConfirmationDto,
    });
  }

  @ApiOkResponse({ type: IncomingTransferPage })
  @Get('chains/:chainId/safes/:safeAddress/incoming-transfers')
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value', required: false, type: String })
  @ApiQuery({ name: 'token_address', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  async getIncomingTransfers(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted: boolean,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to', new ValidationPipe(AddressSchema.optional()))
    to?: `0x${string}`,
    @Query('value') value?: string,
    @Query('token_address', new ValidationPipe(AddressSchema.optional()))
    tokenAddress?: `0x${string}`,
  ): Promise<Partial<Page<IncomingTransfer>>> {
    return this.transactionsService.getIncomingTransfers({
      chainId,
      routeUrl,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      tokenAddress,
      paginationData,
      onlyTrusted: trusted,
    });
  }

  @ApiOkResponse({ type: TransactionPreview })
  @HttpCode(200)
  @Post('chains/:chainId/transactions/:safeAddress/preview')
  async previewTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(PreviewTransactionDtoSchema))
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    return this.transactionsService.previewTransaction({
      chainId,
      safeAddress,
      previewTransactionDto,
    });
  }

  @ApiOkResponse({ type: QueuedItemPage })
  @Get('chains/:chainId/safes/:safeAddress/transactions/queued')
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  async getTransactionQueue(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted: boolean,
  ): Promise<Partial<Page<QueuedItem>>> {
    return this.transactionsService.getTransactionQueue({
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
      trusted,
    });
  }

  @ApiOkResponse({ type: TransactionItemPage })
  @Get('chains/:chainId/safes/:safeAddress/transactions/history')
  @ApiQuery({
    name: 'timezone_offset',
    required: false,
    type: String,
    deprecated: true,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  @ApiQuery({ name: 'imitation', required: false, type: Boolean })
  async getTransactionsHistory(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('timezone_offset', new DefaultValuePipe(0), ParseIntPipe)
    timezoneOffsetMs: number,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted: boolean,
    @Query('imitation', new DefaultValuePipe(true), ParseBoolPipe)
    imitation: boolean,
    @Query('timezone', new ValidationPipe(TimezoneSchema.optional()))
    timezone?: string,
  ): Promise<Partial<TransactionItemPage>> {
    return this.transactionsService.getTransactionHistory({
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
      timezoneOffsetMs,
      onlyTrusted: trusted,
      showImitations: imitation,
      timezone,
    });
  }

  @HttpCode(200)
  @ApiOkResponse({ type: Transaction })
  @Post('chains/:chainId/transactions/:safeAddress/propose')
  async proposeTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(ProposeTransactionDtoSchema))
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<TransactionDetails> {
    return this.transactionsService.proposeTransaction({
      chainId,
      safeAddress,
      proposeTransactionDto,
    });
  }

  @HttpCode(200)
  @ApiOkResponse({ type: CreationTransaction })
  @Get('chains/:chainId/safes/:safeAddress/transactions/creation')
  async getCreationTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<CreationTransaction> {
    return this.transactionsService.getCreationTransaction({
      chainId,
      safeAddress,
    });
  }

  @HttpCode(200)
  @ApiOkResponse({ type: TXSCreationTransaction })
  @ApiOperation({ deprecated: true, summary: 'Deprecated' })
  @Get('chains/:chainId/safes/:safeAddress/creation/raw')
  async getDomainCreationTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<TXSCreationTransaction> {
    return this.transactionsService.getDomainCreationTransaction({
      chainId,
      safeAddress,
    });
  }
}

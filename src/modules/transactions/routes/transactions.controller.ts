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
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { AddConfirmationDto } from '@/modules/transactions/routes/entities/add-confirmation.dto';
import { IncomingTransferPage } from '@/modules/transactions/routes/entities/incoming-transfer-page.entity';
import { IncomingTransfer } from '@/modules/transactions/routes/entities/incoming-transfer.entity';
import { ModuleTransactionPage } from '@/modules/transactions/routes/entities/module-transaction-page.entity';
import { ModuleTransaction } from '@/modules/transactions/routes/entities/module-transaction.entity';
import { MultisigTransactionPage } from '@/modules/transactions/routes/entities/multisig-transaction-page.entity';
import { MultisigTransaction } from '@/modules/transactions/routes/entities/multisig-transaction.entity';
import { PreviewTransactionDto } from '@/modules/transactions/routes/entities/preview-transaction.dto.entity';
import { ProposeTransactionDto } from '@/modules/transactions/routes/entities/propose-transaction.dto.entity';
import { QueuedItemPage } from '@/modules/transactions/routes/entities/queued-item-page.entity';
import { QueuedItem } from '@/modules/transactions/routes/entities/queued-item.entity';
import { TransactionDetails } from '@/modules/transactions/routes/entities/transaction-details/transaction-details.entity';
import { TransactionItemPage } from '@/modules/transactions/routes/entities/transaction-item-page.entity';
import { TransactionPreview } from '@/modules/transactions/routes/entities/transaction-preview.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';
import { AddConfirmationDtoSchema } from '@/modules/transactions/routes/entities/schemas/add-confirmation.dto.schema';
import { PreviewTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/preview-transaction.dto.schema';
import { ProposeTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';
import { TransactionsService } from '@/modules/transactions/routes/transactions.service';
import { DeleteTransactionDto } from '@/modules/transactions/routes/entities/delete-transaction.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { DeleteTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/delete-transaction.dto.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { CreationTransaction } from '@/modules/transactions/routes/entities/creation-transaction.entity';
import { TimezoneSchema } from '@/validation/entities/schemas/timezone.schema';
import { TXSMultisigTransaction } from '@/modules/transactions/routes/entities/txs-multisig-transaction.entity';
import { TXSMultisigTransactionPage } from '@/modules/transactions/routes/entities/txs-multisig-transaction-page.entity';
import { TXSCreationTransaction } from '@/modules/transactions/routes/entities/txs-creation-transaction.entity';
import type { Address } from 'viem';

@ApiTags('transactions')
@Controller({
  path: '',
  version: '1',
})
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOperation({
    summary: 'Get transaction details',
    description:
      'Retrieves detailed information about a specific transaction by its ID, including execution status, confirmations, and decoded transaction data.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the transaction exists',
    example: '1',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description:
      'Transaction ID (safe transaction hash or multisig transaction ID)',
    example: 'multisig_0x1234567890123456789012345678901234567890_0x5678...',
  })
  @ApiOkResponse({
    type: TransactionDetails,
    description: 'Transaction details retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
  })
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
    safeAddress: Address,
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

  @ApiOperation({
    summary: 'Get multisig transactions',
    description:
      'Retrieves a paginated list of multisig transactions for a Safe with optional filtering by execution date, recipient, value, nonce, and execution status.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'execution_date__gte',
    required: false,
    type: String,
    description:
      'Filter by execution date greater than or equal to (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'execution_date__lte',
    required: false,
    type: String,
    description:
      'Filter by execution date less than or equal to (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'Filter by recipient address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'value',
    required: false,
    type: String,
    description: 'Filter by transaction value in wei',
  })
  @ApiQuery({
    name: 'nonce',
    required: false,
    type: String,
    description: 'Filter by transaction nonce',
  })
  @ApiQuery({
    name: 'executed',
    required: false,
    type: Boolean,
    description:
      'Filter by execution status (true for executed, false for pending)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: MultisigTransactionPage,
    description: 'Paginated list of multisig transactions',
  })
  @Get('chains/:chainId/safes/:safeAddress/multisig-transactions')
  async getMultisigTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to', new ValidationPipe(AddressSchema.optional()))
    to?: Address,
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

  @ApiOperation({
    summary: 'Delete transaction',
    description:
      'Deletes a pending multisig transaction. Only the proposer or a Safe owner can delete a transaction.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the transaction exists',
    example: '1',
  })
  @ApiParam({
    name: 'safeTxHash',
    type: 'string',
    description: 'Safe transaction hash (0x prefixed hex string)',
  })
  @ApiBody({
    type: DeleteTransactionDto,
    description: 'Signature proving authorization to delete the transaction',
  })
  @ApiNoContentResponse({
    description: 'Transaction deleted successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid signature or unauthorized deletion attempt',
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
  })
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

  @ApiOperation({
    summary: 'Get module transactions',
    description:
      'Retrieves a paginated list of module transactions for a Safe. Module transactions are executed directly by enabled modules without requiring owner signatures.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'Filter by recipient address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    type: String,
    description: 'Filter by module address that executed the transaction',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiQuery({
    name: 'transaction_hash',
    required: false,
    type: String,
    description: 'Filter by specific transaction hash',
  })
  @ApiOkResponse({
    type: ModuleTransactionPage,
    description: 'Paginated list of module transactions',
  })
  @Get('chains/:chainId/safes/:safeAddress/module-transactions')
  async getModuleTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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

  @ApiOperation({
    summary: 'Add transaction confirmation',
    description:
      'Adds a confirmation signature to a pending multisig transaction. Once enough confirmations are collected to meet the Safe threshold, the transaction can be executed.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeTxHash',
    type: 'string',
    description: 'Safe transaction hash (0x prefixed hex string)',
  })
  @ApiBody({
    type: AddConfirmationDto,
    description:
      'Confirmation signature from a Safe owner proving their approval of the transaction',
  })
  @ApiOkResponse({
    type: Transaction,
    description: 'Transaction details with updated confirmation status',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid signature or confirmation already exists for this owner',
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
  })
  @HttpCode(200)
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

  @ApiOperation({
    summary: 'Get incoming transfers',
    description:
      'Retrieves a paginated list of incoming transfers to a Safe, including ETH and token transfers with optional filtering by date, value, token, and trust status.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'execution_date__gte',
    required: false,
    type: String,
    description:
      'Filter by execution date greater than or equal to (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'execution_date__lte',
    required: false,
    type: String,
    description:
      'Filter by execution date less than or equal to (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'Filter by recipient address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'value',
    required: false,
    type: String,
    description: 'Filter by transfer value in wei',
  })
  @ApiQuery({
    name: 'token_address',
    required: false,
    type: String,
    description:
      'Filter by token contract address (0x prefixed hex string for ERC-20 tokens)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description:
      'Filter by trust status (true for trusted tokens, false for untrusted)',
  })
  @ApiOkResponse({
    type: IncomingTransferPage,
    description: 'Paginated list of incoming transfers',
  })
  @Get('chains/:chainId/safes/:safeAddress/incoming-transfers')
  async getIncomingTransfers(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted: boolean,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to', new ValidationPipe(AddressSchema.optional()))
    to?: Address,
    @Query('value') value?: string,
    @Query('token_address', new ValidationPipe(AddressSchema.optional()))
    tokenAddress?: Address,
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

  @ApiOperation({
    summary: 'Preview transaction',
    description:
      'Simulates a transaction execution to preview its effects, including gas estimates, balance changes, and potential errors before actually proposing or executing it.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiBody({
    type: PreviewTransactionDto,
    description:
      'Transaction data to preview including recipient, value, data, and operation type',
  })
  @ApiOkResponse({
    type: TransactionPreview,
    description:
      'Transaction preview with simulation results, gas estimates, and potential effects',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction data or simulation failed',
  })
  @ApiNotFoundResponse({
    description: 'Safe not found',
  })
  @HttpCode(200)
  @Post('chains/:chainId/transactions/:safeAddress/preview')
  async previewTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(PreviewTransactionDtoSchema))
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    return this.transactionsService.previewTransaction({
      chainId,
      safeAddress,
      previewTransactionDto,
    });
  }

  @ApiOperation({
    summary: 'Get transaction queue',
    description:
      'Retrieves a paginated list of queued (pending) transactions for a Safe that are waiting for execution, ordered by nonce.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description:
      'Filter by trust status (true for trusted transactions, false for untrusted)',
  })
  @ApiOkResponse({
    type: QueuedItemPage,
    description: 'Paginated list of queued transactions',
  })
  @Get('chains/:chainId/safes/:safeAddress/transactions/queued')
  async getTransactionQueue(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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

  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Retrieves a paginated list of executed transactions for a Safe, including multisig transactions, module transactions, and incoming transfers, ordered by execution date.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiQuery({
    name: 'timezone_offset',
    required: false,
    type: String,
    deprecated: true,
    description:
      'Deprecated: Timezone offset in milliseconds for date formatting (use timezone parameter instead)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiQuery({
    name: 'timezone',
    required: false,
    type: String,
    description:
      'IANA timezone identifier for date formatting (e.g., "America/New_York")',
  })
  @ApiQuery({
    name: 'trusted',
    required: false,
    type: Boolean,
    description:
      'Filter by trust status (default: true, set to false to include untrusted transactions)',
  })
  @ApiQuery({
    name: 'imitation',
    required: false,
    type: Boolean,
    description:
      'Include imitation transactions in results (default: true, set to false to exclude)',
  })
  @ApiOkResponse({
    type: TransactionItemPage,
    description: 'Paginated list of historical transactions',
  })
  @Get('chains/:chainId/safes/:safeAddress/transactions/history')
  async getTransactionsHistory(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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

  @ApiOperation({
    summary: 'Propose transaction',
    description:
      'Proposes a new multisig transaction for a Safe. The transaction will be pending until enough owners sign it to reach the required threshold.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiBody({
    type: ProposeTransactionDto,
    description:
      'Transaction proposal including recipient, value, data, and initial signature',
  })
  @ApiOkResponse({
    type: TransactionDetails,
    description: 'Transaction proposed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction data or signature',
  })
  @HttpCode(200)
  @Post('chains/:chainId/transactions/:safeAddress/propose')
  async proposeTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Body(new ValidationPipe(ProposeTransactionDtoSchema))
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<TransactionDetails> {
    return this.transactionsService.proposeTransaction({
      chainId,
      safeAddress,
      proposeTransactionDto,
    });
  }

  @ApiOperation({
    summary: 'Get Safe creation transaction',
    description:
      'Retrieves the transaction that created the Safe, including the creation timestamp, creator address, factory used, and setup data.',
  })
  @ApiParam({
    name: 'chainId',
    type: 'string',
    description: 'Chain ID where the Safe is deployed',
    example: '1',
  })
  @ApiParam({
    name: 'safeAddress',
    type: 'string',
    description: 'Safe contract address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: CreationTransaction,
    description: 'Safe creation transaction details',
  })
  @ApiNotFoundResponse({
    description: 'Safe not found or creation transaction not available',
  })
  @HttpCode(200)
  @Get('chains/:chainId/safes/:safeAddress/transactions/creation')
  async getCreationTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
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
    safeAddress: Address,
  ): Promise<TXSCreationTransaction> {
    return this.transactionsService.getDomainCreationTransaction({
      chainId,
      safeAddress,
    });
  }
}

import type { Backbone } from '@/modules/backbone/domain/entities/backbone.entity';
import type { Singleton } from '@/modules/chains/domain/entities/singleton.entity';
import type { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Estimation } from '@/modules/estimations/domain/entities/estimation.entity';
import type { GetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';
import type { IndexingStatus } from '@/modules/indexing/domain/entities/indexing-status.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { CreationTransaction } from '@/modules/safe/domain/entities/creation-transaction.entity';
import type { ModuleTransaction } from '@/modules/safe/domain/entities/module-transaction.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { SafeList } from '@/modules/safe/domain/entities/safe-list.entity';
import type { Safe, SafeV2 } from '@/modules/safe/domain/entities/safe.entity';
import type { Transaction } from '@/modules/safe/domain/entities/transaction.entity';
import type { Transfer } from '@/modules/safe/domain/entities/transfer.entity';
import type { Token } from '@/modules/tokens/domain/entities/token.entity';
import type { AddConfirmationDto } from '@/modules/transactions/domain/entities/add-confirmation.dto.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address, Hex } from 'viem';

export interface ITransactionApi {
  getDataDecoded(args: {
    data: Address;
    to?: Address;
  }): Promise<Raw<DataDecoded>>;

  getBackbone(): Promise<Raw<Backbone>>;

  getSingletons(): Promise<Raw<Array<Singleton>>>;

  getIndexingStatus(): Promise<Raw<IndexingStatus>>;

  getSafe(safeAddress: Address): Promise<Raw<Safe>>;

  clearSafe(address: Address): Promise<void>;

  isSafe(address: Address): Promise<boolean>;

  clearIsSafe(address: Address): Promise<void>;

  getDelegates(args: {
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>>;

  getDelegatesV2(args: {
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>>;

  clearDelegates(safeAddress?: Address): Promise<void>;

  postDelegate(args: {
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  postDelegateV2(args: {
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    delegate: Address;
    delegator: Address;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    delegate: Address;
    safeAddress: Address;
    signature: string;
  }): Promise<unknown>;

  deleteDelegateV2(args: {
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown>;

  getTransfer(transferId: string): Promise<Raw<Transfer>>;

  getTransfers(args: {
    safeAddress: Address;
    onlyErc20?: boolean;
    onlyErc721?: boolean;
    limit?: number;
    offset?: number;
    to?: Address;
  }): Promise<Raw<Page<Transfer>>>;

  clearTransfers(safeAddress: Address): Promise<void>;

  getIncomingTransfers(args: {
    safeAddress: Address;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: Address;
    value?: string;
    tokenAddress?: Address;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Transfer>>>;

  clearIncomingTransfers(safeAddress: Address): Promise<void>;

  postConfirmation(args: {
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getSafesByModule(moduleAddress: Address): Promise<Raw<SafeList>>;

  getModuleTransaction(
    moduleTransactionId: string,
  ): Promise<Raw<ModuleTransaction>>;

  getModuleTransactions(args: {
    safeAddress: Address;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<ModuleTransaction>>>;

  clearModuleTransactions(safeAddress: Address): Promise<void>;

  getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<Raw<MultisigTransaction>>;

  getMultisigTransactionWithNoCache(
    safeTransactionHash: string,
  ): Promise<Raw<MultisigTransaction>>;

  deleteTransaction(args: {
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  clearMultisigTransaction(safeTransactionHash: string): Promise<void>;

  getMultisigTransactions(args: {
    safeAddress: Address;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: Address;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>>;

  getMultisigTransactionsWithNoCache(args: {
    safeAddress: Address;
    // Transaction Service parameters
    failed?: boolean;
    modified__lt?: string;
    modified__gt?: string;
    modified__lte?: string;
    modified__gte?: string;
    nonce__lt?: number;
    nonce__gt?: number;
    nonce__lte?: number;
    nonce__gte?: number;
    nonce?: number;
    safe_tx_hash?: string;
    to?: string;
    value__lt?: number;
    value__gt?: number;
    value?: number;
    executed?: boolean;
    has_confirmations?: boolean;
    trusted?: boolean;
    execution_date__gte?: string;
    execution_date__lte?: string;
    submission_date__gte?: string;
    submission_date__lte?: string;
    transaction_hash?: string;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>>;

  clearMultisigTransactions(safeAddress: Address): Promise<void>;

  getCreationTransaction(
    safeAddress: Address,
  ): Promise<Raw<CreationTransaction>>;

  getCreationTransactionWithNoCache(
    safeAddress: Address,
  ): Promise<Raw<CreationTransaction>>;

  getAllTransactions(args: {
    safeAddress: Address;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Transaction>>>;

  clearAllTransactions(safeAddress: Address): Promise<void>;

  getToken(address: Address): Promise<Raw<Token>>;

  getTokens(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Token>>>;

  getSafesByOwner(ownerAddress: Address): Promise<Raw<SafeList>>;

  getSafesByOwnerV2(args: {
    ownerAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<SafeV2>>>;

  getEstimation(args: {
    address: Address;
    getEstimationDto: GetEstimationDto;
  }): Promise<Raw<Estimation>>;

  getMessageByHash(messageHash: string): Promise<Raw<Message>>;

  getMessagesBySafe(args: {
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Message>>>;

  postMultisigTransaction(args: {
    address: Address;
    data: ProposeTransactionDto;
  }): Promise<unknown>;

  postMessage(args: {
    safeAddress: Address;
    message: unknown;
    safeAppId: number | null;
    signature: string;
    origin: string | null;
  }): Promise<Raw<Message>>;

  postMessageSignature(args: {
    messageHash: string;
    signature: Hex;
  }): Promise<unknown>;

  clearMessagesBySafe(args: { safeAddress: Address }): Promise<void>;

  clearMessagesByHash(args: { messageHash: string }): Promise<void>;
}

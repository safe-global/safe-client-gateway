import type { Backbone } from '@/domain/backbone/entities/backbone.entity';
import type { Singleton } from '@/domain/chains/entities/singleton.entity';
import type { Contract } from '@/domain/contracts/entities/contract.entity';
import type { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Estimation } from '@/domain/estimations/entities/estimation.entity';
import type { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import type { IndexingStatus } from '@/domain/indexing/entities/indexing-status.entity';
import type { Message } from '@/domain/messages/entities/message.entity';
import type { Device } from '@/domain/notifications/v1/entities/device.entity';
import type { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import type { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { SafeList } from '@/domain/safe/entities/safe-list.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';
import type { Transaction } from '@/domain/safe/entities/transaction.entity';
import type { Transfer } from '@/domain/safe/entities/transfer.entity';
import type { Token } from '@/domain/tokens/entities/token.entity';
import type { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import type { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

export interface ITransactionApi {
  getDataDecoded(args: {
    data: `0x${string}`;
    to?: `0x${string}`;
  }): Promise<DataDecoded>;

  getBackbone(): Promise<Backbone>;

  getSingletons(): Promise<Singleton[]>;

  getIndexingStatus(): Promise<IndexingStatus>;

  getSafe(safeAddress: `0x${string}`): Promise<Safe>;

  clearSafe(address: `0x${string}`): Promise<void>;

  isSafe(address: `0x${string}`): Promise<boolean>;

  clearIsSafe(address: `0x${string}`): Promise<void>;

  getContract(contractAddress: `0x${string}`): Promise<Contract>;

  getDelegates(args: {
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  getDelegatesV2(args: {
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void>;

  postDelegateV2(args: {
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    delegate: `0x${string}`;
    safeAddress: `0x${string}`;
    signature: string;
  }): Promise<unknown>;

  deleteDelegateV2(args: {
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    safeAddress: `0x${string}` | null;
    signature: string;
  }): Promise<unknown>;

  getTransfer(transferId: string): Promise<Transfer>;

  getTransfers(args: {
    safeAddress: string;
    onlyErc20?: boolean;
    onlyErc721?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearTransfers(safeAddress: string): Promise<void>;

  getIncomingTransfers(args: {
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearIncomingTransfers(safeAddress: string): Promise<void>;

  postConfirmation(args: {
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getSafesByModule(moduleAddress: string): Promise<SafeList>;

  getModuleTransaction(moduleTransactionId: string): Promise<ModuleTransaction>;

  getModuleTransactions(args: {
    safeAddress: `0x${string}`;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>>;

  clearModuleTransactions(safeAddress: `0x${string}`): Promise<void>;

  getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction>;

  deleteTransaction(args: {
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  clearMultisigTransaction(safeTransactionHash: string): Promise<void>;

  getMultisigTransactions(args: {
    safeAddress: `0x${string}`;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  clearMultisigTransactions(safeAddress: string): Promise<void>;

  getCreationTransaction(
    safeAddress: `0x${string}`,
  ): Promise<CreationTransaction>;

  getAllTransactions(args: {
    safeAddress: `0x${string}`;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>>;

  clearAllTransactions(safeAddress: `0x${string}`): Promise<void>;

  getToken(address: string): Promise<Token>;

  getTokens(args: { limit?: number; offset?: number }): Promise<Page<Token>>;

  getSafesByOwner(ownerAddress: `0x${string}`): Promise<SafeList>;

  postDeviceRegistration(args: {
    device: Device;
    safes: string[];
    signatures: string[];
  }): Promise<void>;

  deleteDeviceRegistration(uuid: string): Promise<void>;

  deleteSafeRegistration(args: {
    uuid: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  getEstimation(args: {
    address: `0x${string}`;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation>;

  getMessageByHash(messageHash: string): Promise<Message>;

  getMessagesBySafe(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>>;

  postMultisigTransaction(args: {
    address: string;
    data: ProposeTransactionDto;
  }): Promise<unknown>;

  postMessage(args: {
    safeAddress: `0x${string}`;
    message: unknown;
    safeAppId: number | null;
    signature: string;
  }): Promise<Message>;

  postMessageSignature(args: {
    messageHash: string;
    signature: `0x${string}`;
  }): Promise<unknown>;

  clearMessagesBySafe(args: { safeAddress: `0x${string}` }): Promise<void>;

  clearMessagesByHash(args: { messageHash: string }): Promise<void>;
}

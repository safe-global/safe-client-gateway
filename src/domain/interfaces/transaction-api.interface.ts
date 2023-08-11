import { Backbone } from '../backbone/entities/backbone.entity';
import { Balance } from '../balances/entities/balance.entity';
import { Page } from '../entities/page.entity';
import { Collectible } from '../collectibles/entities/collectible.entity';
import { MasterCopy } from '../chains/entities/master-copies.entity';
import { Safe } from '../safe/entities/safe.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { DataDecoded } from '../data-decoder/entities/data-decoded.entity';
import { Delegate } from '../delegate/entities/delegate.entity';
import { Transfer } from '../safe/entities/transfer.entity';
import { MultisigTransaction } from '../safe/entities/multisig-transaction.entity';
import { Transaction } from '../safe/entities/transaction.entity';
import { Token } from '../tokens/entities/token.entity';
import { ModuleTransaction } from '../safe/entities/module-transaction.entity';
import { SafeList } from '../safe/entities/safe-list.entity';
import { CreationTransaction } from '../safe/entities/creation-transaction.entity';
import { Device } from '../notifications/entities/device.entity';
import { GetEstimationDto } from '../estimations/entities/get-estimation.dto.entity';
import { Estimation } from '../estimations/entities/estimation.entity';
import { Message } from '../messages/entities/message.entity';
import { ProposeTransactionDto } from '../transactions/entities/propose-transaction.dto.entity';
import { AddConfirmationDto } from '../transactions/entities/add-confirmation.dto.entity';

export interface ITransactionApi {
  getBalances(args: {
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]>;

  clearLocalBalances(safeAddress: string): Promise<void>;

  getDataDecoded(args: { data: string; to?: string }): Promise<DataDecoded>;

  getCollectibles(args: {
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(safeAddress: string): Promise<void>;

  getBackbone(): Promise<Backbone>;

  getMasterCopies(): Promise<MasterCopy[]>;

  getSafe(safeAddress: string): Promise<Safe>;

  clearSafe(address: string): Promise<void>;

  getContract(contractAddress: string): Promise<Contract>;

  getDelegates(args: {
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    signature?: string;
    label?: string;
  }): Promise<void>;

  deleteDelegate(args: {
    delegate: string;
    delegator: string;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    delegate: string;
    safeAddress: string;
    signature: string;
  }): Promise<void>;

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
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearIncomingTransfers(safeAddress: string): Promise<void>;

  postConfirmation(args: {
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getModuleTransaction(moduleTransactionId: string): Promise<ModuleTransaction>;

  getModuleTransactions(args: {
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>>;

  clearModuleTransactions(safeAddress: string): Promise<void>;

  getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction>;

  clearMultisigTransaction(safeTransactionHash: string): Promise<void>;

  getMultisigTransactions(args: {
    safeAddress: string;
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

  getCreationTransaction(safeAddress: string): Promise<CreationTransaction>;

  getAllTransactions(args: {
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>>;

  clearAllTransactions(safeAddress: string): Promise<void>;

  getToken(address: string): Promise<Token>;

  getTokens(args: { limit?: number; offset?: number }): Promise<Page<Token>>;

  getSafesByOwner(ownerAddress: string): Promise<SafeList>;

  postDeviceRegistration(args: {
    device: Device;
    safes: string[];
    signatures: string[];
  }): Promise<void>;

  deleteDeviceRegistration(uuid: string): Promise<void>;

  deleteSafeRegistration(args: {
    uuid: string;
    safeAddress: string;
  }): Promise<void>;

  getEstimation(args: {
    address: string;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation>;

  getMessageByHash(messageHash: string): Promise<Message>;

  getMessagesBySafe(args: {
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>>;

  postMultisigTransaction(args: {
    address: string;
    data: ProposeTransactionDto;
  }): Promise<unknown>;

  postMessage(args: {
    safeAddress: string;
    message: string | unknown;
    safeAppId: number | null;
    signature: string;
  }): Promise<Message>;

  postMessageSignature(args: {
    messageHash: string;
    signature: string;
  }): Promise<unknown>;
}

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

export interface ITransactionApi {
  getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;

  clearLocalBalances(safeAddress: string): Promise<void>;

  getDataDecoded(data: string, to: string): Promise<DataDecoded>;

  getCollectibles(
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>>;

  getBackbone(): Promise<Backbone>;

  getMasterCopies(): Promise<MasterCopy[]>;

  getSafe(safeAddress: string): Promise<Safe>;

  getContract(contractAddress: string): Promise<Contract>;

  getDelegates(
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Delegate>>;

  postDelegate(
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    signature?: string,
    label?: string,
  ): Promise<unknown>;

  deleteDelegate(
    delegate: string,
    delegator: string,
    signature: string,
  ): Promise<unknown>;

  getTransfers(
    safeAddress: string,
    onlyErc20?: boolean,
    onlyErc721?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>>;

  getIncomingTransfers(
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    tokenAddress?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>>;

  getModuleTransactions(
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<ModuleTransaction>>;

  getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction>;

  getMultisigTransactions(
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    trusted?: boolean,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>>;

  getCreationTransaction(safeAddress: string): Promise<CreationTransaction>;

  getAllTransactions(
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    queued?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>>;

  getToken(address: string): Promise<Token>;

  getTokens(limit?: number, offset?: number): Promise<Page<Token>>;

  getSafesByOwner(ownerAddress: string): Promise<SafeList>;

  postDeviceRegistration(device: Device, safes: string[], signatures: string[]);
}

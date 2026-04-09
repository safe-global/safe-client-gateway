// SPDX-License-Identifier: FSL-1.1-MIT
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import type {
  IOffchain,
  OffchainMultisigTransaction,
} from '@/modules/offchain/offchain.interface';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';

@Injectable()
export class OffchainTxService implements IOffchain {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.postMultisigTransaction({
      address: args.safeAddress,
      data: args.proposeTransactionDto,
    });
  }

  async getMultisigTransaction(args: {
    chainId: string;
    safeTxHash: string;
  }): Promise<Raw<MultisigTransaction>> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.getMultisigTransaction(args.safeTxHash);
  }

  async getTransactionQueue(args: {
    chainId: string;
    safeAddress: Address;
    ordering?: string;
    trusted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.getMultisigTransactions({
      safeAddress: args.safeAddress,
      ordering: args.ordering,
      executed: false,
      trusted: args.trusted,
      limit: args.limit,
      offset: args.offset,
    });
  }

  async postConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<unknown> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.postConfirmation({
      safeTxHash: args.safeTxHash,
      addConfirmationDto: { signature: args.signature as Address },
    });
  }

  async deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.deleteTransaction({
      safeTxHash: args.safeTxHash,
      signature: args.signature,
    });
  }

  async getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.getDelegatesV2({
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      label: args.label,
      limit: args.limit,
      offset: args.offset,
    });
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.postDelegateV2({
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      signature: args.signature,
      label: args.label,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.deleteDelegateV2({
      delegate: args.delegate,
      delegator: args.delegator,
      safeAddress: args.safeAddress,
      signature: args.signature,
    });
  }

  async getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Raw<Message>> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.getMessageByHash(args.messageHash);
  }

  async getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Message>>> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.getMessagesBySafe({
      safeAddress: args.safeAddress,
      limit: args.limit,
      offset: args.offset,
    });
  }

  async postMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: unknown;
    safeAppId: number | null;
    signature: string;
    origin: string | null;
  }): Promise<Raw<Message>> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.postMessage({
      safeAddress: args.safeAddress,
      message: args.message,
      safeAppId: args.safeAppId,
      signature: args.signature,
      origin: args.origin,
    });
  }

  async postMessageSignature(args: {
    chainId: string;
    messageHash: string;
    signature: Hex;
  }): Promise<unknown> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    return api.postMessageSignature({
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

  /**
   * TX service does not have batch metadata — return empty map.
   */
  getTransactionMetadataBatch(): Promise<
    Map<string, OffchainMultisigTransaction>
  > {
    return Promise.resolve(new Map());
  }
}

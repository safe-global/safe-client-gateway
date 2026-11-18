// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { Page } from '#/domain/entities/page.entity';
import type { Message } from '#/modules/messages/domain/entities/message.entity';
import type { TypedData } from '#/modules/messages/domain/entities/typed-data.entity';

export const IMessagesRepository = Symbol('IMessagesRepository');

export interface IMessagesRepository {
  getMessageByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<Message>;

  getMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>>;

  getLastModifiedMessage(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Message | null>;

  createMessage(args: {
    chainId: string;
    safeAddress: Address;
    message: string | TypedData;
    signature: Hex;
    origin: string | null;
  }): Promise<unknown>;

  updateMessageSignature(args: {
    chainId: string;
    messageHash: string;
    signature: string;
  }): Promise<unknown>;

  /**
   * Clears the Safe's messages (and the message, when `messageHash` is given)
   * on every cache layer, then records when the Safe's messages changed. The
   * change is not recorded when a layer fails to clear.
   */
  clearMessagesAndRecordChange(args: {
    chainId: string;
    safeAddress: Address;
    messageHash?: string;
    changedAt: Date;
  }): Promise<void>;

  /** Resolves to whether every cache layer was cleared; failures are logged. */
  clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<boolean>;

  /** Resolves to whether every cache layer was cleared; failures are logged. */
  clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<boolean>;
}

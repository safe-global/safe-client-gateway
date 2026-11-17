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

  /**
   * When the Safe's messages last changed, as recorded from message events and
   * from writes made through this service. Null when nothing was recorded
   * within the default cache TTL, when it cannot be read, or when the Queue
   * Service is off: the caller then derives it from the messages themselves.
   */
  getMessagesChangedAt(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Date | null>;

  /**
   * Records when the Safe's messages changed. Best-effort: a failure is
   * logged, as the tag then falls back to the messages themselves.
   */
  setMessagesChangedAt(args: {
    chainId: string;
    safeAddress: Address;
    changedAt: Date;
  }): Promise<void>;

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

  clearMessagesBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  clearMessagesByHash(args: {
    chainId: string;
    messageHash: string;
  }): Promise<void>;
}

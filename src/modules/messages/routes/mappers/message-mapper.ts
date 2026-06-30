// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Message as DomainMessage } from '@/modules/messages/domain/entities/message.entity';
import type { MessageConfirmation as DomainMessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';
import {
  Message,
  MessageStatus,
} from '@/modules/messages/routes/entities/message.entity';
import { MessageConfirmation } from '@/modules/messages/routes/entities/message-confirmation.entity';
import { MessageItem } from '@/modules/messages/routes/entities/message-item.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { SafeAppInfoMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';

@Injectable()
export class MessageMapper {
  constructor(
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {}

  mapMessageItems(
    chainId: string,
    domainMessages: Array<DomainMessage>,
    safe: Safe,
  ): Promise<Array<MessageItem>> {
    return Promise.all(
      domainMessages.map(async (domainMessage) => {
        const message = await this.mapMessage(chainId, domainMessage, safe);
        /* eslint-disable @typescript-eslint/no-deprecated -- forwarding legacy mirror fields to MessageItem */
        return new MessageItem(
          message.messageHash,
          message.status,
          message.logoUri,
          message.name,
          message.message,
          message.creationTimestamp,
          message.modifiedTimestamp,
          message.confirmationsSubmitted,
          message.confirmationsRequired,
          message.proposedBy,
          message.confirmations,
          message.preparedSignature,
          message.origin,
          message.safeAppInfo,
          message.safeAppId,
        );
        /* eslint-enable @typescript-eslint/no-deprecated */
      }),
    );
  }

  async mapMessage(
    chainId: string,
    message: DomainMessage,
    safe: Safe,
  ): Promise<Message> {
    const safeAppInfo = await this.safeAppInfoMapper.mapSafeAppInfo(
      chainId,
      message.origin,
      message.messageHash,
    );
    const status =
      message.confirmations.length >= safe.threshold
        ? MessageStatus.Confirmed
        : MessageStatus.NeedsConfirmation;
    const proposedBy = await this.addressInfoHelper.getOrDefault(
      chainId,
      message.proposedBy,
      ['CONTRACT'],
    );
    const confirmations = await this.mapConfirmations(
      chainId,
      message.confirmations,
    );
    const preparedSignature =
      message.preparedSignature && status === MessageStatus.Confirmed
        ? message.preparedSignature
        : null;

    return new Message(
      message.messageHash,
      status,
      safeAppInfo?.logoUri ?? null,
      safeAppInfo?.name ?? null,
      message.message,
      message.created.getTime(),
      message.modified.getTime(),
      message.confirmations.length,
      safe.threshold,
      proposedBy,
      confirmations,
      preparedSignature,
      message.origin,
      safeAppInfo,
      safeAppInfo?.id ?? null,
    );
  }

  private mapConfirmations(
    chainId: string,
    confirmations: Array<DomainMessageConfirmation>,
  ): Promise<Array<MessageConfirmation>> {
    return Promise.all(
      confirmations.map(async (confirmation) => {
        const owner = await this.addressInfoHelper.getOrDefault(
          chainId,
          confirmation.owner,
          ['CONTRACT'],
        );
        return new MessageConfirmation(owner, confirmation.signature);
      }),
    );
  }
}

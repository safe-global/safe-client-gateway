import { Inject, Injectable } from '@nestjs/common';
import { MessageConfirmation as DomainMessageConfirmation } from '../../../domain/messages/entities/message-confirmation.entity';
import { Message as DomainMessage } from '../../../domain/messages/entities/message.entity';
import { SafeAppsRepository } from '../../../domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '../../../domain/safe-apps/safe-apps.repository.interface';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '../../common/address-info/address-info.helper';
import { MessageConfirmation } from '../entities/message-confirmation.entity';
import { Message, MessageStatus } from '../entities/message.entity';

@Injectable()
export class MessageMapper {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {}

  async mapMessage(
    chainId: string,
    message: DomainMessage,
    safe: Safe,
  ): Promise<Message> {
    const safeApp = message.safeAppId
      ? await this.safeAppsRepository.getSafeAppById(chainId, message.safeAppId)
      : null;
    const status =
      message.confirmations.length >= safe.threshold
        ? MessageStatus.Confirmed
        : MessageStatus.NeedsConfirmation;
    const proposedBy = await this.addressInfoHelper.getOrDefault(
      chainId,
      message.proposedBy,
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
      safeApp?.iconUrl ?? null,
      safeApp?.name ?? null,
      message.message,
      message.created.getTime(),
      message.modified.getTime(),
      message.confirmations.length,
      safe.threshold,
      proposedBy,
      confirmations,
      preparedSignature,
    );
  }

  private async mapConfirmations(
    chainId: string,
    confirmations: DomainMessageConfirmation[],
  ): Promise<MessageConfirmation[]> {
    return Promise.all(
      confirmations.map(async (confirmation) => {
        const owner = await this.addressInfoHelper.getOrDefault(
          chainId,
          confirmation.owner,
        );
        return new MessageConfirmation(owner, confirmation.signature);
      }),
    );
  }
}

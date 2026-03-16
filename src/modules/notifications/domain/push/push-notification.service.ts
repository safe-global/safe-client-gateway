// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { Event } from '@/modules/hooks/routes/entities/event.entity';
import type { DeletedMultisigTransactionEvent } from '@/modules/hooks/routes/entities/schemas/deleted-multisig-transaction.schema';
import type { ExecutedTransactionEvent } from '@/modules/hooks/routes/entities/schemas/executed-transaction.schema';
import type { IncomingEtherEvent } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';
import type { IncomingTokenEvent } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';
import type { ModuleTransactionEvent } from '@/modules/hooks/routes/entities/schemas/module-transaction.schema';
import type { PendingTransactionEvent } from '@/modules/hooks/routes/entities/schemas/pending-transaction.schema';
import type { MessageCreatedEvent } from '@/modules/hooks/routes/entities/schemas/message-created.schema';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { Confirmation } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';
import {
  NotificationType,
  type ConfirmationRequestNotification,
  type IncomingEtherNotification,
  type IncomingTokenNotification,
  type MessageConfirmationNotification,
  type Notification,
} from '@/modules/notifications/domain/v2/entities/notification.entity';
import type { MessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';
import type { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';
import type {
  PushNotificationDeliveryJobData,
  PushNotificationJobResponse,
} from '@/modules/notifications/domain/push/entities/push-notification-job-data.entity';
import type { Address } from 'viem';
import type { UUID } from 'crypto';
import uniqBy from 'lodash/uniqBy';

type EventToNotify =
  | DeletedMultisigTransactionEvent
  | ExecutedTransactionEvent
  | IncomingEtherEvent
  | IncomingTokenEvent
  | ModuleTransactionEvent
  | MessageCreatedEvent
  | PendingTransactionEvent;

/**
 * Static allowlist of event types that trigger push notifications.
 * New event types are excluded by default unless explicitly added here.
 */
const NOTIFIABLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  TransactionEventType.DELETED_MULTISIG_TRANSACTION,
  TransactionEventType.EXECUTED_MULTISIG_TRANSACTION,
  TransactionEventType.INCOMING_ETHER,
  TransactionEventType.INCOMING_TOKEN,
  TransactionEventType.MODULE_TRANSACTION,
  TransactionEventType.MESSAGE_CREATED,
  TransactionEventType.PENDING_MULTISIG_TRANSACTION,
]);

@Injectable()
export class PushNotificationService implements IPushNotificationService {
  constructor(
    @Inject(IJobQueueService)
    private readonly jobQueueService: IJobQueueService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesRepository: IDelegatesV2Repository,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: IMessagesRepository,
    @Inject(INotificationsRepositoryV2)
    private readonly notificationsRepository: INotificationsRepositoryV2,
  ) {}
  /**
   * Enqueues a push notification event for processing.
   * Errors are logged internally — callers are guaranteed this will not throw.
   *
   * @param event - The webhook {@link Event} to process
   */
  async enqueueEvent(event: Event): Promise<void> {
    try {
      await this.jobQueueService.addJob(JobType.PUSH_NOTIFICATION_EVENT, {
        event,
      });
    } catch (error) {
      this.loggingService.error(
        `Failed to enqueue push notification event: ${asError(error).message}`,
      );
    }
  }

  /**
   * Stage 1 pipeline: filter event → resolve subscribers → map notifications → out delivery jobs.
   *
   * @param event - The webhook {@link Event} to process
   * @returns Number of delivery jobs created.
   */
  async processEvent(event: Event): Promise<number> {
    if (!this.isEventToNotify(event)) {
      return 0;
    }

    // Fetch Safe once for the entire event processing (eliminates N+1 getSafe calls)
    const safe = this.isOwnerOrDelegateOnlyEventToNotify(event)
      ? await this.safeRepository.getSafe({
          chainId: event.chainId,
          address: event.address,
        })
      : null;

    const subscriptions = await this.getRelevantSubscribers(event, safe);

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const notification = await this.mapEventNotification(
          event,
          subscription.subscriber,
          safe,
        );

        if (!notification) {
          return false;
        }

        await this.jobQueueService.addJob(JobType.PUSH_NOTIFICATION_DELIVERY, {
          token: subscription.cloudMessagingToken,
          deviceUuid: subscription.deviceUuid,
          notification: { data: notification },
          chainId: notification.chainId,
          safeAddress: notification.address,
          notificationType: notification.type,
        });
        this.loggingService.info({
          type: LogType.NotificationDeliveryQueued,
          chainId: notification.chainId,
          safeAddress: notification.address,
          notificationType: notification.type,
          deviceUuid: subscription.deviceUuid,
          token: subscription.cloudMessagingToken,
        });
        return true;
      }),
    );

    const deliveryJobCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true,
    ).length;

    this.loggingService.info({
      type: LogType.NotificationEventProcessed,
      eventType: event.type,
      chainId: event.chainId,
      address: event.address,
      deliveryJobCount,
    });

    return deliveryJobCount;
  }

  /**
   * Stage 2 pipeline: deliver a single push notification to FCM.
   * Transient errors propagate (BullMQ retries).
   *
   * @param data - The data for the push notification delivery job
   * @returns A promise that resolves when the push notification is delivered
   */
  async processDelivery(
    data: PushNotificationDeliveryJobData,
  ): Promise<PushNotificationJobResponse> {
    await this.notificationsRepository.enqueueNotification({
      token: data.token,
      deviceUuid: data.deviceUuid,
      notification: data.notification,
    });
    this.loggingService.info({
      type: LogType.NotificationSent,
      chainId: data.chainId,
      safeAddress: data.safeAddress,
      notificationType: data.notificationType,
      deviceUuid: data.deviceUuid,
      token: data.token,
    });
    return { delivered: true };
  }

  /**
   * Checks if the event is notifiable.
   *
   * @param event - The webhook {@link Event} to check
   * @returns True if the event is notifiable, false otherwise
   */
  private isEventToNotify(event: Event): event is EventToNotify {
    return NOTIFIABLE_EVENT_TYPES.has(event.type);
  }

  /**
   * Checks if the event is an owner or delegate only event.
   *
   * @param event - The webhook {@link Event} to check
   * @returns True if the event is an owner or delegate only event, false otherwise
   */
  private isOwnerOrDelegateOnlyEventToNotify(
    event: EventToNotify,
  ): event is PendingTransactionEvent | MessageCreatedEvent {
    // We only notify required confirmation events to owners or delegates
    // to prevent other subscribers from receiving "private" events
    return (
      event.type === TransactionEventType.PENDING_MULTISIG_TRANSACTION ||
      event.type === TransactionEventType.MESSAGE_CREATED
    );
  }

  /**
   * Gets subscribers and their device UUID/cloud messaging tokens for the
   * given Safe depending on the event type.
   *
   * @param event - The webhook {@link Event} to get subscribers for
   * @param safe - The safe to get subscribers for
   * @returns A promise that resolves with the relevant subscribers
   */
  private async getRelevantSubscribers(
    event: EventToNotify,
    safe: Safe | null,
  ): Promise<
    Array<{
      subscriber: Address | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  > {
    // If two or more owner keys are registered for the same device we shouldn't send the notification multiple times and therefore we need to group by their cloudMessagingToken
    const subscriptions = uniqBy(
      await this.notificationsRepository.getSubscribersBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      'cloudMessagingToken',
    );

    if (!this.isOwnerOrDelegateOnlyEventToNotify(event)) {
      return subscriptions;
    }

    const ownersAndDelegates = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        if (!subscription.subscriber) {
          return;
        }

        const isOwnerOrDelegate = await this.isOwnerOrDelegate({
          safe,
          chainId: event.chainId,
          safeAddress: event.address,
          subscriber: subscription.subscriber,
        });

        if (!isOwnerOrDelegate) {
          return;
        }

        return subscription;
      }),
    );

    return ownersAndDelegates
      .filter(
        <T>(
          item: PromiseSettledResult<T>,
        ): item is PromiseFulfilledResult<NonNullable<T>> => {
          return item.status === 'fulfilled' && !!item.value;
        },
      )
      .map((result) => result.value);
  }

  /**
   * Checks if the subscriber is an owner or delegate.
   *
   * @param args - The arguments to check
   * @returns True if the subscriber is an owner or delegate, false otherwise
   */
  private async isOwnerOrDelegate(args: {
    safe: Safe | null;
    chainId: string;
    safeAddress: Address;
    subscriber: Address;
  }): Promise<boolean> {
    // We don't use Promise.all to avoid unnecessary calls for delegates
    const safe =
      args.safe ??
      (await this.safeRepository.getSafe({
        chainId: args.chainId,
        address: args.safeAddress,
      }));

    if (safe.owners.includes(args.subscriber)) {
      return true;
    }
    // Unfortunately, the delegate endpoint does not return any results when querying for the delegators of a safe. Instead, you need to query for the delegators of a delegate key.
    const delegates = await this.delegatesRepository.getDelegates({
      chainId: args.chainId,
      delegate: args.subscriber,
    });

    return (delegates?.results ?? []).some((delegate: { delegator: Address }) =>
      safe.owners.includes(delegate.delegator),
    );
  }

  /**
   * Maps an {@link EventToNotify} to a notification.
   *
   * @param event - {@link EventToNotify} to map
   * @param subscriber - Subscriber address
   *
   * @returns - The {@link Notification} if the conditions are met, otherwise null
   */
  private async mapEventNotification(
    event: EventToNotify,
    subscriber: Address | null,
    safe: Safe | null,
  ): Promise<Notification | null> {
    if (
      event.type === TransactionEventType.INCOMING_ETHER ||
      event.type === TransactionEventType.INCOMING_TOKEN
    ) {
      return this.mapIncomingAssetEventNotification(event);
    } else if (
      event.type === TransactionEventType.PENDING_MULTISIG_TRANSACTION
    ) {
      if (!subscriber) {
        return null;
      }
      return this.mapPendingMultisigTransactionEventNotification(
        event,
        subscriber,
        safe,
      );
    } else if (event.type === TransactionEventType.MESSAGE_CREATED) {
      if (!subscriber) {
        return null;
      }
      return this.mapMessageCreatedEventNotification(event, subscriber, safe);
    } else {
      return event;
    }
  }

  /**
   * Maps {@link IncomingEtherEvent} or {@link IncomingTokenEvent} to {@link IncomingEtherNotification} or {@link IncomingTokenNotification} if:
   *
   * - The asset was sent to the Safe by another address.
   *
   * @param event - {@link IncomingEtherEvent} or {@link IncomingTokenEvent} to map
   *
   * @returns - The {@link IncomingEtherNotification} or {@link IncomingTokenNotification} if the conditions are met, otherwise null
   */
  private async mapIncomingAssetEventNotification(
    event: IncomingEtherEvent | IncomingTokenEvent,
  ): Promise<IncomingEtherNotification | IncomingTokenNotification | null> {
    const incomingTransfers = await this.safeRepository
      .getIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
        txHash: event.txHash,
      })
      .catch((error: unknown) => {
        this.loggingService.warn(
          `Failed to fetch incoming transfers for chain=${event.chainId} safe=${event.address} tx=${event.txHash}: ${asError(error).message}`,
        );
        return null;
      });

    const transfer = incomingTransfers?.results?.find(
      (result: { transactionHash: string }) => {
        return result.transactionHash === event.txHash;
      },
    );

    // Asset sent to self - do not notify
    if (transfer?.from === event.address) {
      return null;
    }

    return event;
  }

  /**
   * Maps {@link PendingTransactionEvent} to {@link ConfirmationRequestNotification} if:
   *
   * - The Safe has a threshold > 1.
   * - The subscriber didn't create the transaction.
   *
   * @param event - {@link PendingTransactionEvent} to map
   * @param subscriber - Subscriber address
   *
   * @returns - The {@link ConfirmationRequestNotification} if the conditions are met, otherwise null
   */
  private async mapPendingMultisigTransactionEventNotification(
    event: PendingTransactionEvent,
    subscriber: Address,
    safe: Safe | null,
  ): Promise<ConfirmationRequestNotification | null> {
    const resolvedSafe =
      safe ??
      (await this.safeRepository.getSafe({
        chainId: event.chainId,
        address: event.address,
      }));

    // Threshold 1 = confirmed and awaiting execution - do not notify
    if (resolvedSafe.threshold === 1) {
      return null;
    }

    const transaction = await this.safeRepository.getMultiSigTransaction({
      chainId: event.chainId,
      safeTransactionHash: event.safeTxHash,
    });

    // Subscriber has already signed - do not notify
    if (!transaction?.confirmations) {
      return null;
    }

    const hasSubscriberSigned = await this.hasSubscriberSigned(
      event.chainId,
      subscriber,
      transaction.confirmations,
    );
    if (hasSubscriberSigned) {
      return null;
    }

    return {
      type: NotificationType.CONFIRMATION_REQUEST,
      to: event.to,
      chainId: event.chainId,
      address: event.address,
      safeTxHash: event.safeTxHash,
    };
  }

  /**
   * Maps {@link MessageCreatedEvent} to {@link MessageConfirmationNotification} if:
   *
   * - The Safe has a threshold > 1.
   * - The subscriber didn't create the message.
   *
   * @param event - {@link MessageCreatedEvent} to map
   * @param subscriber - Subscriber address
   *
   * @returns - The {@link MessageConfirmationNotification} if the conditions are met, otherwise null
   */
  private async mapMessageCreatedEventNotification(
    event: MessageCreatedEvent,
    subscriber: Address,
    safe: Safe | null,
  ): Promise<MessageConfirmationNotification | null> {
    const resolvedSafe =
      safe ??
      (await this.safeRepository.getSafe({
        chainId: event.chainId,
        address: event.address,
      }));

    // Threshold 1 = message is confirmed - do not notify
    if (resolvedSafe.threshold === 1) {
      return null;
    }

    const message = await this.messagesRepository.getMessageByHash({
      chainId: event.chainId,
      messageHash: event.messageHash,
    });

    // Subscriber has already signed - do not notify
    if (!message?.confirmations) {
      return null;
    }

    const hasSubscriberSigned = await this.hasSubscriberSigned(
      event.chainId,
      subscriber,
      message.confirmations,
    );
    if (hasSubscriberSigned) {
      return null;
    }

    return {
      type: NotificationType.MESSAGE_CONFIRMATION_REQUEST,
      chainId: event.chainId,
      address: event.address,
      messageHash: event.messageHash,
    };
  }

  /**
   * Checks if the subscriber has signed the confirmation.
   *
   * @param chainId - The chain ID
   * @param subscriber - The subscriber to check
   * @param confirmations - The confirmations to check
   * @returns True if the subscriber has signed the confirmation, false otherwise
   */
  private async hasSubscriberSigned(
    chainId: string,
    subscriber: Address,
    confirmations: Array<Confirmation | MessageConfirmation>,
  ): Promise<boolean> {
    const delegates = await this.delegatesRepository.getDelegates({
      chainId,
      delegate: subscriber,
    });
    const delegators =
      delegates?.results.map(
        (delegate: { delegator: Address }) => delegate.delegator,
      ) ?? [];
    return confirmations?.some((confirmation) => {
      return (
        confirmation.owner === subscriber ||
        delegators.includes(confirmation.owner)
      );
    });
  }
}

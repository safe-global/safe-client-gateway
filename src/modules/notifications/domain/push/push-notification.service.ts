// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import uniqBy from 'lodash/uniqBy';
import type { Address } from 'viem';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import type { Event } from '@/modules/hooks/routes/entities/event.entity';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { IncomingEtherEvent } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';
import type { IncomingTokenEvent } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';
import type { MessageCreatedEvent } from '@/modules/hooks/routes/entities/schemas/message-created.schema';
import type { PendingTransactionEvent } from '@/modules/hooks/routes/entities/schemas/pending-transaction.schema';
import type { MessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import {
  type EventToNotify,
  NOTIFIABLE_EVENT_TYPES,
} from '@/modules/notifications/domain/push/entities/event-to-notify.entity';
import type {
  PushNotificationDeliveryJobData,
  PushNotificationJobResponse,
  ResolvedSubscriber,
} from '@/modules/notifications/domain/push/entities/push-notification-job-data.entity';
import type { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';
import {
  type ConfirmationRequestNotification,
  type IncomingEtherNotification,
  type IncomingTokenNotification,
  type MessageConfirmationNotification,
  type Notification,
  NotificationType,
} from '@/modules/notifications/domain/v2/entities/notification.entity';
import { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';
import type { Confirmation } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

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

    const deliveryJobCount = (
      await Promise.all(
        subscriptions.map(async (subscription): Promise<number> => {
          try {
            const notification = await this.mapEventNotification(
              event,
              subscription.subscriber,
              safe,
              subscription.delegates ?? [],
            );

            if (!notification) {
              return 0;
            }

            await this.jobQueueService.addJob(
              JobType.PUSH_NOTIFICATION_DELIVERY,
              {
                token: subscription.cloudMessagingToken,
                deviceUuid: subscription.deviceUuid,
                notification: { data: notification },
                chainId: notification.chainId,
                safeAddress: notification.address,
                notificationType: notification.type,
              },
            );
            this.loggingService.info({
              type: LogType.NotificationDeliveryQueued,
              chainId: notification.chainId,
              safeAddress: notification.address,
              notificationType: notification.type,
              deviceUuid: subscription.deviceUuid,
            });
            return 1;
          } catch (error) {
            this.loggingService.warn({
              type: LogType.NotificationError,
              event: `Failed to process subscription: ${asError(error).message}`,
              chainId: event.chainId,
              safeAddress: event.address,
            });
            return 0;
          }
        }),
      )
    ).reduce((sum, n) => sum + n, 0);

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
   * given Safe depending on the event type. For owner-only events, resolves
   * delegate records and attaches them to each subscriber for downstream use.
   *
   * @param event - The webhook {@link Event} to get subscribers for
   * @param safe - The safe to get subscribers for
   * @returns Resolved subscribers with pre-fetched delegate records
   */
  private async getRelevantSubscribers(
    event: EventToNotify,
    safe: Safe | null,
  ): Promise<Array<ResolvedSubscriber>> {
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

    const resolved = await Promise.allSettled(
      subscriptions.map(
        async (subscription): Promise<ResolvedSubscriber | null> => {
          if (!subscription.subscriber) {
            return null;
          }

          const delegates = await this.resolveSubscriberDelegates({
            safe,
            chainId: event.chainId,
            safeAddress: event.address,
            subscriber: subscription.subscriber,
          });

          if (!delegates) {
            return null;
          }

          return { ...subscription, delegates };
        },
      ),
    );

    return resolved
      .filter(
        (
          item,
        ): item is PromiseFulfilledResult<NonNullable<ResolvedSubscriber>> => {
          return item.status === 'fulfilled' && item.value !== null;
        },
      )
      .map((result) => result.value);
  }

  /**
   * Resolves the subscriber's delegate records if they are an owner or delegate.
   *
   * @param args - The arguments to check
   * @returns Delegate records for the subscriber, or null if not an owner/delegate.
   *          Empty array means the subscriber is a direct owner (no delegate lookup needed).
   */
  private async resolveSubscriberDelegates(args: {
    safe: Safe | null;
    chainId: string;
    safeAddress: Address;
    subscriber: Address;
  }): Promise<Array<Delegate> | null> {
    // We don't use Promise.all to avoid unnecessary calls for delegates
    const safe =
      args.safe ??
      (await this.safeRepository.getSafe({
        chainId: args.chainId,
        address: args.safeAddress,
      }));

    if (safe.owners.includes(args.subscriber)) {
      return [];
    }
    // Unfortunately, the delegate endpoint does not return any results when querying for the delegators of a safe. Instead, you need to query for the delegators of a delegate key.
    const delegates = await this.delegatesRepository.getDelegates({
      chainId: args.chainId,
      delegate: args.subscriber,
    });

    const results = delegates?.results ?? [];
    const isDelegate = results.some((delegate: { delegator: Address }) =>
      safe.owners.includes(delegate.delegator),
    );

    return isDelegate ? results : null;
  }

  /**
   * Maps an {@link EventToNotify} to a notification.
   *
   * @param event - {@link EventToNotify} to map
   * @param subscriber - Subscriber address
   * @param safe - Pre-fetched Safe (null for non-owner events)
   * @param delegates - Pre-fetched delegate records for this subscriber
   *
   * @returns The {@link Notification} if the conditions are met, otherwise null
   */
  // biome-ignore lint/suspicious/useAwait: async needed to wrap non-Promise returns in Promise
  private async mapEventNotification(
    event: EventToNotify,
    subscriber: Address | null,
    safe: Safe | null,
    delegates: Array<Delegate>,
  ): Promise<Notification | null> {
    if (
      event.type === TransactionEventType.INCOMING_ETHER ||
      event.type === TransactionEventType.INCOMING_TOKEN
    ) {
      return this.mapIncomingAssetEventNotification(event);
    }
    if (event.type === TransactionEventType.PENDING_MULTISIG_TRANSACTION) {
      if (!subscriber) {
        return null;
      }
      return this.mapPendingMultisigTransactionEventNotification(
        event,
        subscriber,
        safe,
        delegates,
      );
    }
    if (event.type === TransactionEventType.MESSAGE_CREATED) {
      if (!subscriber) {
        return null;
      }
      return this.mapMessageCreatedEventNotification(
        event,
        subscriber,
        safe,
        delegates,
      );
    }
    if (event.type === TransactionEventType.DELETED_MULTISIG_TRANSACTION) {
      return {
        type: event.type,
        chainId: event.chainId,
        address: event.address,
        safeTxHash: event.safeTxHash,
      };
    }
    if (event.type === TransactionEventType.EXECUTED_MULTISIG_TRANSACTION) {
      return {
        type: event.type,
        chainId: event.chainId,
        address: event.address,
        to: event.to,
        safeTxHash: event.safeTxHash,
        txHash: event.txHash,
        failed: event.failed,
        data: event.data,
      };
    }
    if (event.type === TransactionEventType.MODULE_TRANSACTION) {
      return {
        type: event.type,
        chainId: event.chainId,
        address: event.address,
        module: event.module,
        txHash: event.txHash,
      };
    }
    return null;
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

    // Transfer lookup failed suppress rather than risk notifying on a self-send
    if (incomingTransfers === null) {
      return null;
    }

    const transfer = incomingTransfers.results?.find(
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
   * - The subscriber (or their delegator) hasn't already signed.
   *
   * @param event - {@link PendingTransactionEvent} to map
   * @param subscriber - Subscriber address
   * @param safe - Pre-fetched Safe (null triggers lazy fetch)
   * @param delegates - Pre-fetched delegate records for this subscriber
   *
   * @returns The {@link ConfirmationRequestNotification} if the conditions are met, otherwise null
   */
  private async mapPendingMultisigTransactionEventNotification(
    event: PendingTransactionEvent,
    subscriber: Address,
    safe: Safe | null,
    delegates: Array<Delegate>,
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

    if (
      this.hasSubscriberSigned(subscriber, transaction.confirmations, delegates)
    ) {
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
   * - The subscriber (or their delegator) hasn't already signed.
   *
   * @param event - {@link MessageCreatedEvent} to map
   * @param subscriber - Subscriber address
   * @param safe - Pre-fetched Safe (null triggers lazy fetch)
   * @param delegates - Pre-fetched delegate records for this subscriber
   *
   * @returns The {@link MessageConfirmationNotification} if the conditions are met, otherwise null
   */
  private async mapMessageCreatedEventNotification(
    event: MessageCreatedEvent,
    subscriber: Address,
    safe: Safe | null,
    delegates: Array<Delegate>,
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

    if (
      this.hasSubscriberSigned(subscriber, message.confirmations, delegates)
    ) {
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
   * Checks if the subscriber (or one of their delegators) has already signed.
   *
   * @param subscriber - The subscriber address to check
   * @param confirmations - The confirmations to check against
   * @param delegates - Pre-fetched delegate records for this subscriber
   * @returns True if the subscriber or a delegator has signed
   */
  private hasSubscriberSigned(
    subscriber: Address,
    confirmations: Array<Confirmation | MessageConfirmation>,
    delegates: Array<Delegate>,
  ): boolean {
    const delegators = delegates.map(
      (delegate: { delegator: Address }) => delegate.delegator,
    );
    return confirmations.some((confirmation) => {
      return (
        confirmation.owner === subscriber ||
        delegators.includes(confirmation.owner)
      );
    });
  }
}

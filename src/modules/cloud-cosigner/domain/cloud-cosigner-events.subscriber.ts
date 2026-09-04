// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import { PendingTransactionEventSchema } from '@/modules/cloud-cosigner/domain/entities/pending-transaction-event.entity';
import { IQueuesRepository } from '@/modules/queues/domain/queues-repository.interface';

/**
 * Binds the cosigner deployable to the Transaction Service fanout exchange on
 * its own queue (`AMQP_QUEUE`, set differently from the gateway's) and turns
 * each proposal into a review job. Every other event type is ignored here.
 */
@Injectable()
export class CloudCosignerEventsSubscriber implements OnModuleInit {
  private readonly queueName: string;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IQueuesRepository)
    private readonly queuesRepository: IQueuesRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CloudCosignerReviewService)
    private readonly reviewService: CloudCosignerReviewService,
  ) {
    this.queueName = this.configurationService.getOrThrow<string>('amqp.queue');
  }

  onModuleInit(): Promise<void> {
    return this.queuesRepository.subscribe(this.queueName, (msg) =>
      this.onMessage(msg),
    );
  }

  public async onMessage(msg: ConsumeMessage): Promise<void> {
    let content: unknown;
    try {
      content = JSON.parse(msg.content.toString());
    } catch (error) {
      this.loggingService.error({
        type: LogType.CloudCosignerEvent,
        message: `Malformed event: ${asError(error).message}`,
      });
      return;
    }
    const parsed = PendingTransactionEventSchema.safeParse(content);
    if (!parsed.success) {
      return;
    }
    await this.reviewService.enqueueEvent(parsed.data);
  }
}

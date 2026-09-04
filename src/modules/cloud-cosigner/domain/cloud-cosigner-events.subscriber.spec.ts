// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ConsumeMessage } from 'amqplib';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { CloudCosignerEventsSubscriber } from '@/modules/cloud-cosigner/domain/cloud-cosigner-events.subscriber';
import type { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import type { IQueuesRepository } from '@/modules/queues/domain/queues-repository.interface';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockQueuesRepository = {
  subscribe: vi.fn(),
} as MockedObject<IQueuesRepository>;

const mockReviewService = {
  enqueueEvent: vi.fn(),
} as unknown as MockedObject<CloudCosignerReviewService>;

function message(content: unknown): ConsumeMessage {
  return {
    content: Buffer.from(
      typeof content === 'string' ? content : JSON.stringify(content),
    ),
  } as ConsumeMessage;
}

describe('CloudCosignerEventsSubscriber', () => {
  const queueName = faker.word.noun();
  let subscriber: CloudCosignerEventsSubscriber;

  beforeEach(() => {
    const configurationService = new FakeConfigurationService();
    configurationService.set('amqp.queue', queueName);
    subscriber = new CloudCosignerEventsSubscriber(
      mockLoggingService,
      mockQueuesRepository,
      configurationService,
      mockReviewService,
    );
  });

  it('should subscribe to the configured queue on init', async () => {
    mockQueuesRepository.subscribe.mockResolvedValue();

    await subscriber.onModuleInit();

    expect(mockQueuesRepository.subscribe).toHaveBeenCalledWith(
      queueName,
      expect.any(Function),
    );
  });

  it('should enqueue a pending multisig transaction event', async () => {
    const event = {
      type: 'PENDING_MULTISIG_TRANSACTION',
      chainId: faker.string.numeric(),
      address: getAddress(faker.finance.ethereumAddress()),
      to: getAddress(faker.finance.ethereumAddress()),
      safeTxHash: faker.string.hexadecimal({ length: 64 }),
    };

    await subscriber.onMessage(message(event));

    expect(mockReviewService.enqueueEvent).toHaveBeenCalledWith({
      type: event.type,
      chainId: event.chainId,
      address: event.address,
      safeTxHash: event.safeTxHash,
    });
  });

  it('should ignore every other event type', async () => {
    await subscriber.onMessage(
      message({
        type: 'NEW_CONFIRMATION',
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        owner: getAddress(faker.finance.ethereumAddress()),
        safeTxHash: faker.string.hexadecimal({ length: 64 }),
      }),
    );

    expect(mockReviewService.enqueueEvent).not.toHaveBeenCalled();
  });

  it('should log and drop a payload that is not JSON', async () => {
    await subscriber.onMessage(message('not json'));

    expect(mockReviewService.enqueueEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Malformed event'),
      }),
    );
  });
});

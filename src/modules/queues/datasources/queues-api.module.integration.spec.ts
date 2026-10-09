// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Channel, type ChannelModel, connect } from 'amqplib';
import { fakeJson } from '@/__tests__/faker';
import { retry } from '@/__tests__/util/retry';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import configuration from '@/config/entities/configuration';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import {
  type QueueConsumer,
  queueConsumerFactory,
} from '@/modules/queues/datasources/queues-api.module';

const amqpUrl = configuration().amqp.url;

function randomName(): string {
  return `test-${faker.string.uuid()}`;
}

describe('queueConsumerFactory', () => {
  let connection: ChannelModel;
  let channel: Channel;
  let consumer: QueueConsumer | undefined;
  let exchange: string;
  let queue: string;

  function createConsumer(): QueueConsumer {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('amqp.url', amqpUrl);
    fakeConfigurationService.set('amqp.exchange.name', exchange);
    fakeConfigurationService.set('amqp.queue', queue);
    fakeConfigurationService.set('amqp.prefetch', 100);
    fakeConfigurationService.set('amqp.heartbeatIntervalInSeconds', 60);
    fakeConfigurationService.set('amqp.reconnectTimeInSeconds', 5);
    consumer = queueConsumerFactory(fakeConfigurationService);
    return consumer;
  }

  beforeAll(async () => {
    connection = await connect(amqpUrl);
    channel = await connection.createChannel();
  });

  beforeEach(() => {
    exchange = randomName();
    queue = randomName();
  });

  afterEach(async () => {
    await consumer?.channel.close();
    await consumer?.connection.close();
    consumer = undefined;
    await channel.deleteQueue(queue);
    await channel.deleteExchange(exchange);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('should declare the exchange as a durable topic exchange', async () => {
    await createConsumer().channel.waitForConnect();

    // Asserting with other arguments fails with PRECONDITION_FAILED
    await expect(
      channel.assertExchange(exchange, 'topic', { durable: true }),
    ).resolves.toEqual({ exchange });
  });

  it('should bind the queue to the topic exchange for every routing key', async () => {
    await createConsumer().channel.waitForConnect();
    const chainId = faker.string.numeric();
    const type = faker.helpers.enumValue(TransactionEventType);
    // `{chainId}.{type}.{address}`, with `_` for a missing part
    const routingKeys = [
      `${chainId}.${type}.${faker.finance.ethereumAddress().toLowerCase()}`,
      `${chainId}.${type}._`,
      '_._._',
    ];

    for (const routingKey of routingKeys) {
      channel.publish(exchange, routingKey, Buffer.from(fakeJson()));
    }

    await retry(async () => {
      const result = await channel.checkQueue(queue);
      expect(result.messageCount).toBe(routingKeys.length);
    });
  });
});

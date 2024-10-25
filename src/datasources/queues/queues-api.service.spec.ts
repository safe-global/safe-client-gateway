import type { QueueConsumer } from '@/datasources/queues/queues-api.module';
import { QueueApiService } from '@/datasources/queues/queues-api.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';

const mockQueueConsumer = {
  connection: {
    isConnected: jest.fn(),
  },
  channel: {
    consume: jest.fn(),
    ack: jest.fn(),
  },
} as jest.MockedObjectDeep<QueueConsumer>;

const mockLoggingService = {
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('QueuesApi', () => {
  let service: QueueApiService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('isReady', () => {
    it('should return true if the consumer connection is available', () => {
      mockQueueConsumer.connection.isConnected.mockReturnValue(true);
      service = new QueueApiService(mockQueueConsumer, mockLoggingService);

      expect(service.isReady()).toBe(true);
    });

    it('should return false if the consumer connection is not available', () => {
      mockQueueConsumer.connection.isConnected.mockReturnValue(false);
      service = new QueueApiService(mockQueueConsumer, mockLoggingService);

      expect(service.isReady()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to the queue', async () => {
      service = new QueueApiService(mockQueueConsumer, mockLoggingService);
      const fn = jest.fn();

      await service.subscribe(faker.string.sample(), fn);

      expect(mockQueueConsumer.channel.consume).toHaveBeenCalledTimes(1);
      expect(mockQueueConsumer.channel.ack).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    });
  });
});

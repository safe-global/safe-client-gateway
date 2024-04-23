import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { QueueConsumer } from '@/datasources/queues/queues-api.module';
import { QueueApiService } from '@/datasources/queues/queues-api.service';
import { ILoggingService } from '@/logging/logging.interface';
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
  const fakeConfigurationService: FakeConfigurationService =
    new FakeConfigurationService();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('isReady', () => {
    it('should return true if FF is not active and the consumer connection is not available', () => {
      fakeConfigurationService.set('features.eventsQueue', false);
      mockQueueConsumer.connection.isConnected.mockReturnValue(false);
      service = new QueueApiService(
        mockQueueConsumer,
        mockLoggingService,
        fakeConfigurationService,
      );

      expect(service.isReady()).toBe(true);
    });

    it('should return true if FF is not active and the consumer connection is available', () => {
      fakeConfigurationService.set('features.eventsQueue', false);
      mockQueueConsumer.connection.isConnected.mockReturnValue(true);
      service = new QueueApiService(
        mockQueueConsumer,
        mockLoggingService,
        fakeConfigurationService,
      );

      expect(service.isReady()).toBe(true);
    });

    it('should return true if FF is active and the consumer connection is available', () => {
      fakeConfigurationService.set('features.eventsQueue', true);
      mockQueueConsumer.connection.isConnected.mockReturnValue(true);
      service = new QueueApiService(
        mockQueueConsumer,
        mockLoggingService,
        fakeConfigurationService,
      );

      expect(service.isReady()).toBe(true);
    });

    it('should return false if FF is active and the consumer connection is not available', () => {
      fakeConfigurationService.set('features.eventsQueue', true);
      mockQueueConsumer.connection.isConnected.mockReturnValue(false);
      service = new QueueApiService(
        mockQueueConsumer,
        mockLoggingService,
        fakeConfigurationService,
      );

      expect(service.isReady()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should not subscribe to the queue if the FF is not active', async () => {
      fakeConfigurationService.set('features.eventsQueue', false);
      service = new QueueApiService(
        mockQueueConsumer,
        mockLoggingService,
        fakeConfigurationService,
      );
      const fn = jest.fn();

      await service.subscribe(faker.string.sample(), fn);

      expect(mockQueueConsumer.channel.consume).not.toHaveBeenCalled();
      expect(mockQueueConsumer.channel.ack).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to the queue if the FF is active', async () => {
      fakeConfigurationService.set('features.eventsQueue', true);
      service = new QueueApiService(
        mockQueueConsumer,
        mockLoggingService,
        fakeConfigurationService,
      );
      const fn = jest.fn();

      await service.subscribe(faker.string.sample(), fn);

      expect(mockQueueConsumer.channel.consume).toHaveBeenCalledTimes(1);
      expect(mockQueueConsumer.channel.ack).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    });
  });
});

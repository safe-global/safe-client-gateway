// SPDX-License-Identifier: FSL-1.1-MIT

import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { MockedObject } from '#/__tests__/mocks';
import type { ILoggingService } from '#/logging/logging.interface';
import type { QueueConsumer } from '#/modules/queues/datasources/queues-api.module';
import { QueueApiService } from '#/modules/queues/datasources/queues-api.service';

const mockConnection = {
  isConnected: jest.fn(),
} as MockedObject<AmqpConnectionManager>;

const mockChannel = {
  consume: jest.fn(),
  ack: jest.fn(),
} as MockedObject<ChannelWrapper>;

const mockQueueConsumer: QueueConsumer = {
  connection: mockConnection,
  channel: mockChannel,
};

const mockLoggingService = {
  info: jest.fn(),
  warn: jest.fn(),
} as MockedObject<ILoggingService>;

describe('QueuesApi', () => {
  let service: QueueApiService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('isReady', () => {
    it('should return true if the consumer connection is available', () => {
      mockConnection.isConnected.mockReturnValue(true);
      service = new QueueApiService(mockQueueConsumer, mockLoggingService);

      expect(service.isReady()).toBe(true);
    });

    it('should return false if the consumer connection is not available', () => {
      mockConnection.isConnected.mockReturnValue(false);
      service = new QueueApiService(mockQueueConsumer, mockLoggingService);

      expect(service.isReady()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to the queue', async () => {
      service = new QueueApiService(mockQueueConsumer, mockLoggingService);
      const fn = jest.fn();

      await service.subscribe(faker.string.sample(), fn);

      expect(mockChannel.consume).toHaveBeenCalledTimes(1);
      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    });
  });
});

// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { EmailConsumer } from '@/modules/email/ses/consumers/email.consumer';
import { sendEmailJobDataBuilder } from '@/modules/email/ses/domain/entities/__tests__/send-email-job-data.builder';
import type { SendEmailJobData } from '@/modules/email/ses/domain/entities/email-job-data.entity';
import {
  PermanentEmailError,
  TransientEmailError,
} from '@/modules/email/ses/domain/errors/email.errors';
import type { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';

const mockEmailService = {
  send: vi.fn(),
} as MockedObject<IEmailService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('EmailConsumer', () => {
  let consumer: EmailConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new EmailConsumer(mockLoggingService, mockEmailService);
  });

  const buildJob = (): Job<SendEmailJobData> =>
    ({
      id: faker.string.uuid(),
      data: sendEmailJobDataBuilder().build(),
      attemptsMade: 0,
    }) as unknown as Job<SendEmailJobData>;

  describe('process', () => {
    it('should call emailService.send with job data', async () => {
      mockEmailService.send.mockResolvedValueOnce();
      const job = buildJob();

      await consumer.process(job);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        to: job.data.to,
        subject: job.data.subject,
        htmlBody: job.data.htmlBody,
        textBody: job.data.textBody,
      });
    });

    it('should throw UnrecoverableError on PermanentEmailError', async () => {
      mockEmailService.send.mockRejectedValueOnce(
        new PermanentEmailError('Email rejected'),
      );
      const job = buildJob();

      await expect(consumer.process(job)).rejects.toThrow(UnrecoverableError);
      expect(mockLoggingService.error).toHaveBeenCalled();
    });

    it('should rethrow TransientEmailError for BullMQ retries', async () => {
      const error = new TransientEmailError('Rate limited');
      mockEmailService.send.mockRejectedValueOnce(error);
      const job = buildJob();

      await expect(consumer.process(job)).rejects.toThrow(TransientEmailError);
    });

    it('should rethrow unknown errors for BullMQ retries', async () => {
      const error = new Error('Network timeout');
      mockEmailService.send.mockRejectedValueOnce(error);
      const job = buildJob();

      await expect(consumer.process(job)).rejects.toThrow('Network timeout');
    });
  });

  describe('onCompleted', () => {
    it('should log job completion', () => {
      const job = buildJob();

      consumer.onCompleted(job);

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'EmailConsumer',
          event: expect.stringContaining('completed'),
        }),
      );
    });
  });

  describe('onFailed', () => {
    it('should log job failure with error message', () => {
      const job = buildJob();
      const error = new Error('SES rejected');

      consumer.onFailed(job, error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'EmailConsumer',
          event: expect.stringContaining('SES rejected'),
        }),
      );
    });
  });

  describe('onWorkerError', () => {
    it('should log worker error with error message', () => {
      const error = new Error('Redis connection lost');

      consumer.onWorkerError(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'EmailConsumer',
          event: expect.stringContaining('Redis connection lost'),
        }),
      );
    });
  });
});

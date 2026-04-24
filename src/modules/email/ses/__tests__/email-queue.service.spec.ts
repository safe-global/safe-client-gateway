// SPDX-License-Identifier: FSL-1.1-MIT
import { EmailQueueService } from '@/modules/email/ses/email-queue.service';
import { JobType } from '@/datasources/job-queue/types/job-types';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { sendEmailJobDataBuilder } from '@/modules/email/ses/domain/entities/__tests__/send-email-job-data.builder';

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  const mockJobQueueService = {
    addJob: jest.fn(),
    getJob: jest.fn(),
  } as jest.MockedObjectDeep<IJobQueueService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailQueueService(mockJobQueueService);
  });

  describe('enqueue', () => {
    it('should add a SEND_EMAIL job to the queue', async () => {
      const data = sendEmailJobDataBuilder().build();

      await service.enqueue(data);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.SEND_EMAIL,
        data,
      );
    });

    it('should pass metadata through to the job', async () => {
      const data = sendEmailJobDataBuilder()
        .with('metadata', { memberId: 42, spaceId: 1 })
        .build();

      await service.enqueue(data);

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.SEND_EMAIL,
        data,
      );
    });

    it('should propagate addJob errors to the caller', async () => {
      mockJobQueueService.addJob.mockRejectedValueOnce(
        new Error('Redis connection refused'),
      );
      const data = sendEmailJobDataBuilder().build();

      await expect(service.enqueue(data)).rejects.toThrow(
        'Redis connection refused',
      );
    });
  });
});

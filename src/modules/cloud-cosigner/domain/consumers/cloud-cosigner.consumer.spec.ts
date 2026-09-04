// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { JobType } from '@/datasources/job-queue/types/job-types';
import type { ILoggingService } from '@/logging/logging.interface';
import type { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import { CloudCosignerConsumer } from '@/modules/cloud-cosigner/domain/consumers/cloud-cosigner.consumer';
import type { CloudCosignerJob } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-job.entity';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockReviewService = {
  processReview: vi.fn(),
} as unknown as MockedObject<CloudCosignerReviewService>;

function job(name: string): CloudCosignerJob {
  return {
    id: faker.string.uuid(),
    name,
    attemptsMade: 1,
    data: {
      chainId: faker.string.numeric(),
      safeAddress: getAddress(faker.finance.ethereumAddress()),
      safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
    },
  } as CloudCosignerJob;
}

describe('CloudCosignerConsumer', () => {
  const consumer = new CloudCosignerConsumer(
    mockLoggingService,
    mockReviewService,
  );

  it('should delegate review jobs to the service', async () => {
    const reviewJob = job(JobType.CLOUD_COSIGNER_REVIEW);
    mockReviewService.processReview.mockResolvedValue({
      kind: 'not_enrolled',
    });

    await expect(consumer.process(reviewJob)).resolves.toStrictEqual({
      kind: 'not_enrolled',
    });

    expect(mockReviewService.processReview).toHaveBeenCalledWith(
      reviewJob.data,
    );
  });

  it('should reject unknown job types', () => {
    expect(() => consumer.process(job(JobType.SEND_EMAIL))).toThrow(
      'Unknown job type: send-email',
    );
  });

  it('should log failed jobs with their data', () => {
    const failed = job(JobType.CLOUD_COSIGNER_REVIEW);

    consumer.onFailed(failed, new Error('boom'));

    expect(mockLoggingService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Review job failed: boom',
        jobId: failed.id,
        safeTxHash: failed.data.safeTxHash,
      }),
    );
  });
});

// SPDX-License-Identifier: FSL-1.1-MIT
import type { Queue } from 'bullmq';
import type { MockedObject } from 'vitest';
import type { SafenetCheckJobData } from '#/modules/safenet/domain/entities/safenet-check-job-data.entity';
import { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';

describe('SafenetChecksQueue', () => {
  it('limits the queue to one job at a time across replicas on startup', async () => {
    const queue = {
      setGlobalConcurrency: vi.fn().mockResolvedValue(undefined),
    } as MockedObject<Queue<SafenetCheckJobData>>;

    await new SafenetChecksQueue(queue).onModuleInit();

    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(1);
  });
});

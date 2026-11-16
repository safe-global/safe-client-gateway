// SPDX-License-Identifier: FSL-1.1-MIT
import type { Queue } from 'bullmq';
import type { MockedObject } from 'vitest';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
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

  it.each([
    ['0x64', '100'],
    ['100', '0x64'],
  ])(
    'finds a job added for chain %s when asked for chain %s',
    async (added, asked) => {
      const queue = {
        add: vi.fn().mockResolvedValue(undefined),
        getJob: vi.fn().mockResolvedValue(undefined),
      } as MockedObject<Queue<SafenetCheckJobData>>;
      const target = new SafenetChecksQueue(queue);
      const transaction = multisigTransactionBuilder().build();
      const data: SafenetCheckJobData = {
        chainId: added,
        safe: transaction.safe,
        safeTxHash: transaction.safeTxHash,
        transaction: getBaseMultisigTransaction(transaction),
      };

      await target.enqueue(data);
      await target.has({ ...data, chainId: asked });

      const [[, , options]] = queue.add.mock.calls;
      expect(queue.getJob).toHaveBeenCalledWith(options?.jobId);
    },
  );
});

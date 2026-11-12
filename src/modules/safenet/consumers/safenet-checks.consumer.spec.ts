// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Job, UnrecoverableError } from 'bullmq';
import type { Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import { SafenetChecksConsumer } from '#/modules/safenet/consumers/safenet-checks.consumer';
import { safenetCheckJobDataBuilder } from '#/modules/safenet/domain/entities/__tests__/safenet-check-job-data.builder';
import type { SafenetCheckJobData } from '#/modules/safenet/domain/entities/safenet-check-job-data.entity';
import { SafenetPayerError } from '#/modules/safenet/domain/errors/safenet-payer.error';
import type { SafenetPayer } from '#/modules/safenet/domain/safenet-payer';

// The key `@Processor` stores its worker options under; `@nestjs/bullmq` does not export it.
const WORKER_METADATA = 'bullmq:worker_metadata';

const hash = (): Hex =>
  faker.string.hexadecimal({ length: 64, casing: 'lower' }) as Hex;

describe('SafenetChecksConsumer', () => {
  const payer = { propose: vi.fn() } as MockedObject<SafenetPayer>;
  const logging = {
    info: vi.fn(),
    error: vi.fn(),
  } as MockedObject<ILoggingService>;
  const consumer = new SafenetChecksConsumer(payer, logging);
  const data = safenetCheckJobDataBuilder().build();
  const job = { id: faker.string.uuid(), data } as Job<SafenetCheckJobData>;
  const retryable = new SafenetPayerError('Safenet payer relay failed');
  const paid = new UnrecoverableError('Safenet payer relay timed out');

  it('fails a stalled job, which may have paid, instead of running it again', () => {
    const worker = Reflect.getMetadata(WORKER_METADATA, SafenetChecksConsumer);

    expect(worker).toMatchObject({ maxStalledCount: 0 });
  });

  it('proposes the transaction through the payer', async () => {
    const result = {
      userSafeTxHash: data.safeTxHash,
      transactionHash: hash(),
      payerNonce: faker.number.bigInt({ min: 0n, max: 100n }),
    };
    payer.propose.mockResolvedValue(result);

    await consumer.process(job);

    expect(payer.propose).toHaveBeenCalledWith({
      chainId: data.chainId,
      safe: data.safe,
      transaction: data.transaction,
    });
  });

  it('retries a failure that cannot have paid the fee', async () => {
    const error = new SafenetPayerError('Safenet payer relay failed');
    payer.propose.mockRejectedValue(error);

    await expect(consumer.process(job)).rejects.toBe(error);
  });

  it('does not retry a failure that may have paid the fee', async () => {
    payer.propose.mockRejectedValue(new Error('Safenet payer relay timed out'));

    await expect(consumer.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it.each([
    [
      'removes a job that ran out of attempts after a retryable error',
      retryable,
      3,
      1,
    ],
    ['keeps a job that has attempts left', retryable, 1, 0],
    ['keeps a job that may have paid the fee', paid, 3, 0],
  ])('%s', async (_title, error, attemptsMade, removals) => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const failed = {
      ...job,
      attemptsMade,
      opts: { attempts: 3 },
      remove,
    } as unknown as Job<SafenetCheckJobData>;

    await consumer.onFailed(failed, error);

    expect(remove).toHaveBeenCalledTimes(removals);
  });
});

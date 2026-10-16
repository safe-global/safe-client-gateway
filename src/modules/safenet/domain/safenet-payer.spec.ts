// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  type Address,
  BaseError,
  decodeFunctionData,
  type Hex,
  type Log,
  type PublicClient,
  type TransactionReceipt,
  TransactionReceiptNotFoundError,
  toEventSelector,
  toHex,
  zeroAddress,
} from 'viem';
import type { MockedObject } from 'vitest';
import SafeAbi from '#/abis/safe/v1.4.1/Safe.abi';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { CacheRouter } from '#/datasources/cache/cache.router';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import { getSafeTxHash } from '#/domain/common/utils/safe';
import type { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import type { RelayTaskStatus } from '#/modules/relay/domain/entities/relay-task-status.entity';
import type { RelayRepository } from '#/modules/relay/domain/relay.repository';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { SafenetProposal } from '#/modules/safenet/domain/entities/safenet-payer.entity';
import { SafenetPayerError } from '#/modules/safenet/domain/errors/safenet-payer.error';
import { SafenetPayerMaybePaidError } from '#/modules/safenet/domain/errors/safenet-payer-maybe-paid.error';
import {
  NO_EXTRA_DATA,
  RELAY_STATUS_INCLUDED,
  RELAY_STATUS_PENDING,
  RELAY_STATUS_REJECTED,
  RELAY_STATUS_REVERTED,
} from '#/modules/safenet/domain/safenet.constants';
import { safenetConsensusAbi } from '#/modules/safenet/domain/safenet-consensus.abi';
import { toSafenetConsensusTransaction } from '#/modules/safenet/domain/safenet-consensus-transaction.mapper';
import { SafenetPayer } from '#/modules/safenet/domain/safenet-payer';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

const EXECUTION_SUCCESS_TOPIC = toEventSelector(
  'ExecutionSuccess(bytes32,uint256)',
);

const randomHash = (): Hex => toHex(faker.number.bigInt(), { size: 32 });
const randomAddress = (): Address =>
  AddressSchema.parse(faker.finance.ethereumAddress());
const eventLog = (address: Address, topics: Array<Hex>) =>
  ({ address, topics, data: '0x' }) as unknown as Log<bigint, number, false>;

const NO_EXECUTED = 'Missing payer ExecutionSuccess';

class Harness {
  readonly transaction = multisigTransactionBuilder()
    .with('data', randomHash())
    .build();
  readonly proposal: SafenetProposal = {
    chainId: faker.string.numeric({ exclude: ['0'] }),
    safe: this.transaction.safe,
    transaction: this.transaction,
  };
  readonly safeAddress = randomAddress();
  readonly consensusAddress = randomAddress();
  readonly oracleAddress = randomAddress();
  readonly userSafeTxHash = randomHash();
  readonly transactionHash = randomHash();
  readonly taskId = faker.string.uuid();
  readonly counterKey = CacheRouter.getSafenetPayerNonceCacheKey({
    chainId: '100',
    safeAddress: this.safeAddress,
  });
  readonly executedLog = eventLog(this.safeAddress, [EXECUTION_SUCCESS_TOPIC]);
  readonly logs = [this.executedLog];
  readonly receipt = {
    status: 'success',
    logs: this.logs,
  } as TransactionReceipt;
  readonly signerAddress = randomAddress();
  owner: Address = this.signerAddress;
  threshold = 1n;
  readonly signer = {
    getAddress: vi.fn().mockResolvedValue(this.signerAddress),
    signHash: vi.fn((hash: Hex) => {
      const { topics } = this.executedLog;
      if (topics.length < 2) {
        topics.splice(1, 0, hash);
      }
      return Promise.resolve(toHex(1n, { size: 65 }));
    }),
  };
  readonly client = {
    readContract: vi
      .fn()
      .mockImplementation(
        ({
          functionName,
          args,
        }: {
          functionName: string;
          args?: Array<unknown>;
        }) => {
          const results: Record<string, unknown> = {
            isOwner: args?.[0] === this.owner,
            getThreshold: this.threshold,
            nonce: 2n,
          };
          return Promise.resolve(results[functionName]);
        },
      ),
    call: vi.fn().mockResolvedValue({ data: this.userSafeTxHash }),
    getTransactionReceipt: vi.fn().mockResolvedValue(this.receipt),
  } as MockedObject<PublicClient>;
  readonly blockchain = {
    getUncachedApi: vi.fn().mockResolvedValue(this.client),
  } as MockedObject<IBlockchainApiManager>;
  readonly cache = {
    getCounter: vi.fn().mockResolvedValue(null),
    setCounter: vi.fn().mockResolvedValue(undefined),
  } as MockedObject<ICacheService>;
  readonly relay = {
    relayWithoutLimits: vi.fn().mockResolvedValue({ taskId: this.taskId }),
    getTaskStatus: vi.fn().mockResolvedValue({
      status: RELAY_STATUS_INCLUDED,
      receipt: { transactionHash: this.transactionHash },
    }),
  } as MockedObject<RelayRepository>;
  readonly logging = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  } as MockedObject<ILoggingService>;
  readonly payer = new SafenetPayer(
    this.configuration(),
    this.blockchain,
    this.cache,
    this.relay,
    this.signer,
    this.logging,
  );

  private configuration(): FakeConfigurationService {
    const configuration = new FakeConfigurationService();
    configuration.set('safenet.consensusAddress', this.consensusAddress);
    configuration.set('safenet.oracleAddress', this.oracleAddress);
    configuration.set('safenet.payer.safeAddress', this.safeAddress);
    configuration.set('safenet.pollIntervalMs', 1);
    configuration.set('safenet.pollTimeoutMs', 100);
    configuration.set('expirationTimeInSeconds.safenetNonce', 60);
    return configuration;
  }

  relayStatus(status: number): RelayTaskStatus {
    return { chainId: '100', id: this.taskId, status };
  }

  status(status: number): void {
    this.relay.getTaskStatus.mockResolvedValue(this.relayStatus(status));
  }

  receiptWith(patch: Partial<TransactionReceipt>): void {
    const receipt = { ...this.receipt, ...patch };
    this.client.getTransactionReceipt.mockResolvedValue(receipt);
  }

  tamper(field: number | 'emitter') {
    if (field === 'emitter') {
      this.executedLog.address = randomAddress();
    } else {
      this.executedLog.topics.splice(field, 1, randomHash());
    }
  }

  propose() {
    return this.payer.propose(this.proposal);
  }
}

const upstream = Object.assign(new Error('upstream body'), {
  name: 'TimeoutError',
});

type Arrange = (h: Harness) => unknown;

async function expectPayerError(outcome: Promise<unknown>, message: string) {
  const error = await outcome.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SafenetPayerError);
  expect(error).toMatchObject({ message });
  return error as Error;
}

async function expectMaybePaid(
  outcome: Promise<unknown>,
  message: string,
  taskId: string,
) {
  const error = await outcome.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SafenetPayerMaybePaidError);
  expect(error).not.toBeInstanceOf(SafenetPayerError);
  expect(error).toMatchObject({
    message: `${message} (taskId ${taskId}, payerNonce 2)`,
  });
}

describe('SafenetPayer', () => {
  it('returns the proposal after the payer Safe executed it', async () => {
    const h = new Harness();

    await expect(h.propose()).resolves.toEqual({
      userSafeTxHash: h.userSafeTxHash,
      transactionHash: h.transactionHash,
      payerNonce: 2n,
    });

    expect(h.blockchain.getUncachedApi).toHaveBeenCalledWith('100');
    expect(h.relay.relayWithoutLimits).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: '100', to: h.safeAddress }),
    );
    expect(h.relay.getTaskStatus).toHaveBeenCalledWith({
      chainId: '100',
      taskId: h.taskId,
    });
  });

  it('uses the larger counter when the on-chain nonce is stale', async () => {
    const h = new Harness();
    h.cache.getCounter.mockResolvedValue(7);

    expect((await h.propose()).payerNonce).toBe(7n);
  });

  it('relays proposeTransaction with all payer gas fields zero so inner failure reverts execTransaction', async () => {
    const h = new Harness();

    await h.propose();

    const [{ data, safeTxHash }] = h.relay.relayWithoutLimits.mock.calls[0];
    const { functionName, args } = decodeFunctionData({
      abi: SafeAbi,
      data: HexSchema.parse(data),
    });
    expect(functionName).toBe('execTransaction');
    expect(args?.slice(3, 9)).toEqual([
      Operation.CALL,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
    ]);
    const innerData = HexSchema.parse(args?.[2]);
    expect(
      decodeFunctionData({ abi: safenetConsensusAbi, data: innerData }),
    ).toEqual({
      functionName: 'proposeTransaction',
      args: [
        h.oracleAddress,
        NO_EXTRA_DATA,
        toSafenetConsensusTransaction(h.proposal),
      ],
    });
    expect(safeTxHash).toBe(
      getSafeTxHash({
        chainId: '100',
        safe: safeBuilder()
          .with('address', h.safeAddress)
          .with('version', '1.4.1')
          .build(),
        transaction: {
          to: h.consensusAddress,
          value: '0',
          data: innerData,
          operation: Operation.CALL,
          safeTxGas: 0,
          baseGas: 0,
          gasPrice: '0',
          gasToken: zeroAddress,
          refundReceiver: zeroAddress,
          nonce: 2,
        },
      }),
    );
  });

  it('treats a failed status read as pending', async () => {
    const h = new Harness();
    h.relay.getTaskStatus.mockRejectedValueOnce(new Error('down'));

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
    expect(h.relay.getTaskStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps polling while the relay reports the task as pending', async () => {
    const h = new Harness();
    h.relay.getTaskStatus.mockResolvedValueOnce(
      h.relayStatus(RELAY_STATUS_PENDING),
    );

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
    expect(h.relay.getTaskStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps polling while an Included status has no receipt hash', async () => {
    const h = new Harness();
    h.relay.getTaskStatus.mockResolvedValueOnce(
      h.relayStatus(RELAY_STATUS_INCLUDED),
    );

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
    expect(h.relay.getTaskStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps polling until the receipt is found without logging a warning', async () => {
    const h = new Harness();
    h.client.getTransactionReceipt.mockRejectedValueOnce(
      new TransactionReceiptNotFoundError({ hash: h.transactionHash }),
    );

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
    expect(h.client.getTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(h.logging.warn).not.toHaveBeenCalled();
  });

  it('logs a warning and keeps polling when the receipt read fails', async () => {
    const h = new Harness();
    h.client.getTransactionReceipt.mockRejectedValueOnce(new Error('rpc down'));

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
    expect(h.client.getTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(h.logging.warn).toHaveBeenCalledWith({
      chainId: '100',
      transactionHash: h.transactionHash,
      error: 'Error',
    });
  });

  it('rejects a signer that does not own the payer Safe before the relay', async () => {
    const h = new Harness();
    h.owner = randomAddress();

    await expectPayerError(
      h.propose(),
      `Signer ${h.signerAddress} is not a payer Safe owner`,
    );
    expect(h.client.call).not.toHaveBeenCalled();
    expect(h.relay.relayWithoutLimits).not.toHaveBeenCalled();
  });

  it('rejects a payer Safe with a threshold other than 1 before the relay', async () => {
    const h = new Harness();
    h.threshold = 2n;

    await expectPayerError(
      h.propose(),
      'Payer Safe threshold is 2, expected 1',
    );
    expect(h.client.call).not.toHaveBeenCalled();
    expect(h.relay.relayWithoutLimits).not.toHaveBeenCalled();
  });

  it('checks ownership until it passes once, then not again', async () => {
    const h = new Harness();
    h.owner = randomAddress();
    await expect(h.propose()).rejects.toBeInstanceOf(SafenetPayerError);
    h.owner = h.signerAddress;
    await h.propose();
    h.owner = randomAddress();

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
  });

  it('rejects a simulation revert without the raw error or relay', async () => {
    const h = new Harness();
    h.client.call.mockRejectedValue(
      new BaseError('Execution reverted.', {
        metaMessages: [`data: ${h.userSafeTxHash}`],
      }),
    );

    const error = await expectPayerError(
      h.propose(),
      'Safenet proposal simulation failed: Execution reverted.',
    );

    expect(error.cause).toBeUndefined();
    expect(h.relay.relayWithoutLimits).not.toHaveBeenCalled();
  });

  it.each<[string, Arrange]>([
    ['an RPC error', (h) => h.client.readContract.mockRejectedValue(upstream)],
    ['a KMS error', (h) => h.signer.signHash.mockRejectedValue(upstream)],
  ])('retries %s before the relay', async (_name, arrange) => {
    const h = new Harness();
    arrange(h);

    const error = await expectPayerError(
      h.propose(),
      'Safenet payer failed before relay: TimeoutError',
    );

    expect(error.cause).toBe(upstream);
    expect(h.relay.relayWithoutLimits).not.toHaveBeenCalled();
  });

  it('retries a rejected relay request: nothing was broadcast', async () => {
    const h = new Harness();
    h.status(RELAY_STATUS_REJECTED);

    await expectPayerError(h.propose(), 'Safenet payer relay rejected');
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it.each<[string, string, Arrange]>([
    [
      'a relay timeout',
      'Safenet payer relay timed out',
      (h) => h.status(RELAY_STATUS_PENDING),
    ],
    [
      'status reads that fail until the deadline',
      'Safenet payer relay timed out',
      (h) => h.relay.getTaskStatus.mockRejectedValue(new Error('down')),
    ],
    [
      'an Included status that never has a receipt hash',
      'Safenet payer relay timed out',
      (h) => h.status(RELAY_STATUS_INCLUDED),
    ],
    [
      'a reverted relay task: a copy of the payload may have paid',
      'Safenet payer relay reverted',
      (h) => h.status(RELAY_STATUS_REVERTED),
    ],
  ])('does not classify %s as unpaid', async (_n, msg, arrange) => {
    const h = new Harness();
    arrange(h);

    await expectMaybePaid(h.propose(), msg, h.taskId);
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it.each<[string, string, Arrange]>([
    [
      'a reverted receipt',
      'Safenet payer receipt failed',
      (h) => h.receiptWith({ status: 'reverted' }),
    ],
    [
      'a receipt that is unavailable',
      'Safenet payer receipt unavailable',
      (h) =>
        h.client.getTransactionReceipt.mockRejectedValue(new Error('gone')),
    ],
    ['no ExecutionSuccess', NO_EXECUTED, (h) => h.logs.pop()],
    ['a different payer hash', NO_EXECUTED, (h) => h.tamper(1)],
    ['another event signature', NO_EXECUTED, (h) => h.tamper(0)],
    ['a foreign emitter', NO_EXECUTED, (h) => h.tamper('emitter')],
  ])('does not classify %s as unpaid', async (_n, msg, arrange) => {
    const h = new Harness();
    arrange(h);

    await expectMaybePaid(h.propose(), msg, h.taskId);
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it('returns the proposal and logs when the counter write fails', async () => {
    const h = new Harness();
    h.cache.setCounter.mockRejectedValue(new TypeError('redis down'));

    await expect(h.propose()).resolves.toMatchObject({
      transactionHash: h.transactionHash,
    });
    expect(h.logging.warn).toHaveBeenCalledWith({
      chainId: '100',
      payerNonce: '2',
      error: 'TypeError',
    });
  });
});

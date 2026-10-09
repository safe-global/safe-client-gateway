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
  toEventSelector,
  toHex,
  zeroAddress,
} from 'viem';
import type { MockedObject } from 'vitest';
import SafeAbi from '@/abis/safe/v1.4.1/Safe.abi';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import type { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { RelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import * as Tx from '@/modules/safenet/domain/entities/__tests__/safenet-safe-transaction.builder';
import {
  SafenetPayerError,
  SafenetPayerUnresolvedError,
} from '@/modules/safenet/domain/errors/safenet-payer.error';
import { SafenetPayer } from '@/modules/safenet/domain/safenet-payer';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const PROPOSED_TOPIC =
  '0x47d867ce4d91d0487fa4d2ac80b13e7466ce53dd018a8eef564fc60c92b53d03';
const NEW_REQUEST_TOPIC =
  '0x8ec61272960f97d43d7f8f85ed630aa512818577f3d1e548e7627b06dbbbda86';
const EXECUTION_SUCCESS_TOPIC = toEventSelector(
  'ExecutionSuccess(bytes32,uint256)',
);

const randomHash = (): Hex => toHex(faker.number.bigInt(), { size: 32 });
const randomAddress = (): Address =>
  AddressSchema.parse(faker.finance.ethereumAddress());
const asTopic = (address: Address): Hex => toHex(BigInt(address), { size: 32 });
const eventLog = (address: Address, topics: Array<Hex>) =>
  ({ address, topics, data: '0x' }) as unknown as Log<bigint, number, false>;

const NO_EXECUTED = 'Missing payer ExecutionSuccess';
const NO_PROPOSED = 'Missing Consensus TransactionProposed';
const NO_REQUEST = 'Missing payer Oracle NewRequest';

class Harness {
  readonly transaction = Tx.safenetSafeTransactionBuilder().build();
  readonly safeAddress = randomAddress();
  readonly consensusAddress = randomAddress();
  readonly oracleAddress = randomAddress();
  readonly userSafeTxHash = randomHash();
  readonly requestId = randomHash();
  readonly transactionHash = randomHash();
  readonly taskId = faker.string.uuid();
  readonly counterKey = CacheRouter.getSafenetPayerNonceCacheKey({
    chainId: '100',
    safeAddress: this.safeAddress,
  });
  readonly proposedLog = eventLog(this.consensusAddress, [
    PROPOSED_TOPIC,
    this.userSafeTxHash,
  ]);
  readonly requestLog = eventLog(this.oracleAddress, [
    NEW_REQUEST_TOPIC,
    this.requestId,
    asTopic(this.safeAddress),
  ]);
  readonly executedLog = eventLog(this.safeAddress, [EXECUTION_SUCCESS_TOPIC]);
  readonly logs = [this.proposedLog, this.requestLog, this.executedLog];
  readonly receipt = {
    status: 'success',
    logs: this.logs,
  } as unknown as TransactionReceipt;
  readonly signer = {
    address: randomAddress(),
    signHash: vi.fn((hash: Hex) => {
      const { topics } = this.executedLog;
      if (topics.length < 2) topics.splice(1, 0, hash);
      return Promise.resolve(toHex(1n, { size: 65 }));
    }),
  };
  readonly client = {
    readContract: vi
      .fn()
      .mockImplementation(({ functionName }) =>
        Promise.resolve(functionName === 'VERSION' ? '1.4.1' : 2n),
      ),
    call: vi.fn().mockResolvedValue({ data: this.userSafeTxHash }),
    getTransactionReceipt: vi.fn().mockResolvedValue(this.receipt),
  } as MockedObject<PublicClient>;
  readonly blockchain = {
    getApi: vi.fn().mockResolvedValue(this.client),
  } as MockedObject<IBlockchainApiManager>;
  readonly cache = {
    getCounter: vi.fn().mockResolvedValue(null),
    setCounter: vi.fn().mockResolvedValue(undefined),
  } as MockedObject<ICacheService>;
  readonly relay = {
    relay: vi.fn().mockResolvedValue({ taskId: this.taskId }),
    getTaskStatus: vi.fn().mockResolvedValue({
      status: 200,
      receipt: { transactionHash: this.transactionHash },
    }),
  } as MockedObject<IRelayApi>;
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

  status(status: number): void {
    this.relay.getTaskStatus.mockResolvedValue({ status } as RelayTaskStatus);
  }

  receiptWith(patch: Partial<TransactionReceipt>): void {
    const receipt = { ...this.receipt, ...patch };
    this.client.getTransactionReceipt.mockResolvedValue(receipt);
  }

  tamper(log: 'executed' | 'proposed' | 'request', field: number | 'emitter') {
    const target = this[`${log}Log`];
    if (field === 'emitter') target.address = randomAddress();
    else target.topics.splice(field, 1, randomHash());
  }

  propose() {
    return this.payer.propose(this.transaction);
  }
}

type Arrange = (h: Harness) => unknown;

async function expectPayerError(outcome: Promise<unknown>, message: string) {
  const error = await outcome.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SafenetPayerError);
  expect(error).toMatchObject({ message });
  return error as Error;
}

async function expectUnresolved(
  outcome: Promise<unknown>,
  message: string,
  details: { taskId: string; transactionHash?: Hex },
) {
  const error = await outcome.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SafenetPayerUnresolvedError);
  expect(error).not.toBeInstanceOf(SafenetPayerError);
  expect(error).toMatchObject({
    message,
    details: { payerNonce: 2n, ...details },
  });
}

describe('SafenetPayer', () => {
  it('returns the verified request and advances the nonce after Included', async () => {
    const h = new Harness();

    await expect(h.propose()).resolves.toEqual({
      userSafeTxHash: h.userSafeTxHash,
      requestId: h.requestId,
      transactionHash: h.transactionHash,
      payerNonce: 2n,
    });

    expect(h.blockchain.getApi).toHaveBeenCalledWith('100');
    expect(h.relay.relay).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: '100', to: h.safeAddress }),
    );
    expect(h.relay.getTaskStatus).toHaveBeenCalledWith({
      chainId: '100',
      taskId: h.taskId,
    });
    expect(h.cache.setCounter).toHaveBeenCalledWith(h.counterKey, 3, 60, 0);
  });

  it('uses the larger counter when the on-chain nonce is stale', async () => {
    const h = new Harness();
    h.cache.getCounter.mockResolvedValue(7);

    expect((await h.propose()).payerNonce).toBe(7n);
  });

  it('keeps all payer gas fields zero so inner failure reverts execTransaction', async () => {
    const h = new Harness();

    await h.propose();

    const [{ data, safeTxHash }] = h.relay.relay.mock.calls[0];
    const { functionName, args } = decodeFunctionData({
      abi: SafeAbi,
      data: data as Hex,
    });
    expect(functionName).toBe('execTransaction');
    expect(args?.slice(3, 9)).toEqual([
      0,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
    ]);
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
          data: args?.[2] as Hex,
          operation: 0,
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

  it('rejects a concurrent proposal and releases the payer afterwards', async () => {
    const h = new Harness();
    const first = h.propose();

    await expectPayerError(h.propose(), 'Safenet payer is busy');
    await first;
    expect((await h.propose()).requestId).toBe(h.requestId);
  });

  it('treats a failed status read as pending and logs only its name', async () => {
    const h = new Harness();
    h.relay.getTaskStatus.mockRejectedValueOnce(
      Object.assign(new Error('upstream body'), {
        name: 'NetworkRequestError',
      }),
    );

    await h.propose();

    expect(h.logging.warn).toHaveBeenCalledWith({
      chainId: '100',
      taskId: h.taskId,
      error: 'NetworkRequestError',
    });
  });

  it('retries the receipt read after RPC errors', async () => {
    const h = new Harness();
    h.client.getTransactionReceipt
      .mockRejectedValueOnce(new Error('not found'))
      .mockRejectedValueOnce(new Error('not found'));

    expect((await h.propose()).requestId).toBe(h.requestId);
    expect(h.client.getTransactionReceipt).toHaveBeenCalledTimes(3);
  });

  it('rejects a payer Safe that is not 1.4.1 before simulating', async () => {
    const h = new Harness();
    h.client.readContract.mockResolvedValueOnce('1.3.0');

    await expectPayerError(h.propose(), 'Unsupported payer Safe version 1.3.0');
    expect(h.client.call).not.toHaveBeenCalled();
    expect(h.relay.relay).not.toHaveBeenCalled();
  });

  it('keeps verifying the payer Safe version until a read succeeds', async () => {
    const h = new Harness();
    h.client.readContract.mockResolvedValueOnce('1.3.0');
    await h.propose().catch(() => undefined);

    await h.propose();
    await h.propose();

    const reads = h.client.readContract.mock.calls.filter(
      ([call]) => call.functionName === 'VERSION',
    );
    expect(reads).toHaveLength(2);
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
    expect(h.relay.relay).not.toHaveBeenCalled();
  });

  it.each([400, 500])('rejects relay status %s', async (status) => {
    const h = new Harness();
    h.status(status);

    await expectPayerError(h.propose(), 'Safenet payer relay failed');
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it('rejects a receipt with a failed status', async () => {
    const h = new Harness();
    h.receiptWith({ status: 'reverted' });

    await expectPayerError(h.propose(), 'Safenet payer receipt failed');
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it.each<[string, string, Arrange]>([
    ['a relay timeout', 'Safenet payer relay timed out', (h) => h.status(100)],
    [
      'status reads that fail until the deadline',
      'Safenet payer relay timed out',
      (h) => h.relay.getTaskStatus.mockRejectedValue(new Error('down')),
    ],
    [
      'an Included status without a receipt hash',
      'Included relay has no receipt hash',
      (h) => h.status(200),
    ],
  ])('reports %s before any transaction hash', async (_n, msg, arrange) => {
    const h = new Harness();
    arrange(h);

    await expectUnresolved(h.propose(), msg, { taskId: h.taskId });
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it.each<[string, string, Arrange]>([
    [
      'a receipt that stays unavailable',
      'Included payer receipt unavailable',
      (h) =>
        h.client.getTransactionReceipt.mockRejectedValue(new Error('gone')),
    ],
    ['no ExecutionSuccess', NO_EXECUTED, (h) => h.logs.pop()],
    ['a different payer hash', NO_EXECUTED, (h) => h.tamper('executed', 1)],
    ['another event signature', NO_EXECUTED, (h) => h.tamper('executed', 0)],
    ['a foreign emitter', NO_EXECUTED, (h) => h.tamper('executed', 'emitter')],
  ])('reports %s with its transaction hash', async (_n, msg, arrange) => {
    const h = new Harness();
    arrange(h);

    await expectUnresolved(h.propose(), msg, {
      taskId: h.taskId,
      transactionHash: h.transactionHash,
    });
    expect(h.cache.setCounter).not.toHaveBeenCalled();
  });

  it.each<[string, string, Arrange]>([
    [
      'a counter write failure',
      'Safenet payer nonce counter write failed',
      (h) => h.cache.setCounter.mockRejectedValue(new Error('redis down')),
    ],
    ['a different proposal hash', NO_PROPOSED, (h) => h.tamper('proposed', 1)],
    ['another proposal signature', NO_PROPOSED, (h) => h.tamper('proposed', 0)],
    ['a foreign sponsor', NO_REQUEST, (h) => h.tamper('request', 2)],
    ['another request signature', NO_REQUEST, (h) => h.tamper('request', 0)],
  ])('reports %s after the consumed nonce', async (_n, msg, arrange) => {
    const h = new Harness();
    arrange(h);

    await expectUnresolved(h.propose(), msg, {
      taskId: h.taskId,
      transactionHash: h.transactionHash,
    });
    expect(h.cache.setCounter).toHaveBeenCalledWith(h.counterKey, 3, 60, 0);
  });
});

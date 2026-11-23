// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  erc20Abi,
  getAbiItem,
  getAddress,
  type PublicClient,
  pad,
  toEventSelector,
  toHex,
} from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { DataSourceError } from '#/domain/errors/data-source.error';
import type { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import { TokenApprovalsApi } from '#/modules/token-approvals/datasources/token-approvals-api.service';
import { erc20ApprovalLogEncoder } from '#/modules/token-approvals/domain/entities/__tests__/approval-log-encoder.builder';
import { tokenSpenderBuilder } from '#/modules/token-approvals/domain/entities/__tests__/token-approval.builder';
import { tokenApprovalsScanStateBuilder } from '#/modules/token-approvals/domain/entities/__tests__/token-approvals-scan-state.builder';
import {
  MULTICALL_BATCH_SIZE_BYTES,
  MULTICALL3_ADDRESS,
} from '#/modules/token-approvals/domain/token-approvals.constants';

const cachedClient = {
  request: vi.fn(),
} as MockedObject<PublicClient>;

const uncachedClient = {
  getBlockNumber: vi.fn(),
  multicall: vi.fn(),
} as MockedObject<PublicClient>;

const blockchainApiManager = {
  getApi: vi.fn(),
  getUncachedApi: vi.fn(),
  destroyApi: vi.fn(),
} as MockedObject<IBlockchainApiManager>;

const cacheService = {
  hGet: vi.fn(),
  hSet: vi.fn(),
  deleteByKey: vi.fn(),
} as MockedObject<ICacheService>;

describe('Token approvals chain and cache reads', () => {
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const scanExpirationTimeSeconds = faker.number.int({ min: 1 });
  let target: TokenApprovalsApi;

  beforeEach(() => {
    vi.resetAllMocks();
    blockchainApiManager.getApi.mockResolvedValue(cachedClient);
    blockchainApiManager.getUncachedApi.mockResolvedValue(uncachedClient);
    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'expirationTimeInSeconds.tokenApprovals',
      scanExpirationTimeSeconds,
    );
    target = new TokenApprovalsApi(
      blockchainApiManager,
      cacheService,
      configurationService,
      new HttpErrorFactory(),
    );
  });

  it('should, when the latest block is read, read it past the RPC cache', async () => {
    const head = faker.number.bigInt({ min: 1n, max: 20_000_000n });
    uncachedClient.getBlockNumber.mockResolvedValue(head);

    const actual = await target.getHeadBlockNumber(chainId);

    expect(actual).toBe(head);
    expect(blockchainApiManager.getUncachedApi).toHaveBeenCalledWith({
      chainId,
    });
    expect(blockchainApiManager.getApi).not.toHaveBeenCalled();
  });

  it('should, when Approval logs are read, ask the chain for the logs that name the Safe as owner within the range', async () => {
    const fromBlock = faker.number.int({ min: 0, max: 10_000_000 });
    const toBlock = fromBlock + faker.number.int({ min: 0, max: 10_000 });
    const logs = [
      erc20ApprovalLogEncoder().with('owner', safeAddress).encode(),
    ];
    cachedClient.request.mockResolvedValue(logs);

    const actual = await target.getApprovalLogs({
      chainId,
      owner: safeAddress,
      fromBlock,
      toBlock,
    });

    expect(actual).toStrictEqual(logs);
    expect(blockchainApiManager.getApi).toHaveBeenCalledWith(chainId);
    expect(cachedClient.request).toHaveBeenCalledExactlyOnceWith({
      method: 'eth_getLogs',
      params: [
        {
          fromBlock: toHex(fromBlock),
          toBlock: toHex(toBlock),
          topics: [
            toEventSelector(getAbiItem({ abi: erc20Abi, name: 'Approval' })),
            pad(safeAddress).toLowerCase(),
            null,
          ],
        },
      ],
    });
  });

  it('should, when the provider rejects a range of logs, throw a service unavailable error', async () => {
    cachedClient.request.mockRejectedValue(new Error(faker.lorem.sentence()));

    await expect(
      target.getApprovalLogs({
        chainId,
        owner: safeAddress,
        fromBlock: faker.number.int({ min: 0, max: 10_000_000 }),
        toBlock: faker.number.int({ min: 10_000_001, max: 20_000_000 }),
      }),
    ).rejects.toThrow(new DataSourceError('Service unavailable', 503));
  });

  it('should, when allowances are read, read them past the RPC cache at the given block', async () => {
    const pair = tokenSpenderBuilder().build();
    const blockNumber = faker.number.int({ min: 1, max: 20_000_000 });
    const reads = [
      { status: 'success', result: faker.number.bigInt({ min: 1n }) },
    ];
    uncachedClient.multicall.mockResolvedValue(reads);

    const actual = await target.getAllowances({
      chainId,
      owner: safeAddress,
      pairs: [pair],
      blockNumber,
    });

    expect(actual).toStrictEqual(reads);
    expect(blockchainApiManager.getApi).not.toHaveBeenCalled();
    expect(uncachedClient.multicall).toHaveBeenCalledExactlyOnceWith({
      allowFailure: true,
      multicallAddress: MULTICALL3_ADDRESS,
      batchSize: MULTICALL_BATCH_SIZE_BYTES,
      blockNumber: BigInt(blockNumber),
      contracts: [
        {
          address: pair.tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [safeAddress, pair.spender],
        },
      ],
    });
  });

  it('should, when a scan state is stored, replace the entry of the Safe with the configured expiry', async () => {
    const state = tokenApprovalsScanStateBuilder().build();
    const cacheDir = new CacheDir(
      `${chainId}_token_approvals_scan_${safeAddress}`,
      '',
    );

    await target.setScanState({ chainId, safeAddress, state });

    expect(cacheService.deleteByKey).toHaveBeenCalledExactlyOnceWith(
      cacheDir.key,
    );
    expect(cacheService.hSet).toHaveBeenCalledExactlyOnceWith(
      cacheDir,
      JSON.stringify(state),
      scanExpirationTimeSeconds,
    );
    expect(cacheService.deleteByKey).toHaveBeenCalledBefore(cacheService.hSet);
  });

  it('should, when a scan state is stored for the Safe, read it back', async () => {
    const state = tokenApprovalsScanStateBuilder().build();
    cacheService.hGet.mockResolvedValue(JSON.stringify(state));

    const actual = await target.getScanState({ chainId, safeAddress });

    expect(actual).toStrictEqual(state);
    expect(cacheService.hGet).toHaveBeenCalledExactlyOnceWith(
      new CacheDir(`${chainId}_token_approvals_scan_${safeAddress}`, ''),
    );
  });

  it('should, when no scan state is stored for the Safe, return null', async () => {
    cacheService.hGet.mockResolvedValue(null);

    const actual = await target.getScanState({ chainId, safeAddress });

    expect(actual).toBeNull();
  });
});

// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { DataSourceError } from '#/domain/errors/data-source.error';
import type { ILoggingService } from '#/logging/logging.interface';
import type { TokenApprovalsApi } from '#/modules/token-approvals/datasources/token-approvals-api.service';
import {
  erc20ApprovalLogEncoder,
  erc721ApprovalLogEncoder,
} from '#/modules/token-approvals/domain/entities/__tests__/approval-log-encoder.builder';
import { tokenSpenderBuilder } from '#/modules/token-approvals/domain/entities/__tests__/token-approval.builder';
import { tokenApprovalsScanStateBuilder } from '#/modules/token-approvals/domain/entities/__tests__/token-approvals-scan-state.builder';
import { TokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository';
import { rawify } from '#/validation/entities/raw.entity';

const tokenApprovalsApi = {
  getHeadBlockNumber: vi.fn(),
  getApprovalLogs: vi.fn(),
  getAllowances: vi.fn(),
  getScanState: vi.fn(),
  setScanState: vi.fn(),
} as MockedObject<TokenApprovalsApi>;

const loggingService = {
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('Token approvals scan', () => {
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  let configurationService: FakeConfigurationService;
  let target: TokenApprovalsRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    configurationService = new FakeConfigurationService();
    configurationService.set(
      'tokenApprovals.logs.maxRequests',
      faker.number.int({ min: 32, max: 64 }),
    );
    configurationService.set(
      'tokenApprovals.maxPairs',
      faker.number.int({ min: 10, max: 100 }),
    );
    target = new TokenApprovalsRepository(
      configurationService,
      loggingService,
      tokenApprovalsApi,
    );
  });

  it('should, when the Safe gave an allowance above zero, return it and report the list as complete', async () => {
    const head = faker.number.int({ min: 1, max: 20_000_000 });
    const tokenAddress = getAddress(faker.finance.ethereumAddress());
    const spender = getAddress(faker.finance.ethereumAddress());
    const allowance = faker.number.bigInt({ min: 1n });
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(
      rawify([
        erc20ApprovalLogEncoder()
          .with('tokenAddress', tokenAddress)
          .with('owner', safeAddress)
          .with('spender', spender)
          .encode(),
      ]),
    );
    tokenApprovalsApi.getAllowances.mockResolvedValue(
      rawify([{ status: 'success', result: allowance }]),
    );

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({
      approvals: [{ tokenAddress, spender, allowance }],
      isComplete: true,
    });
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenCalledExactlyOnceWith({
      chainId,
      owner: safeAddress,
      fromBlock: 0,
      toBlock: head,
    });
    expect(tokenApprovalsApi.getAllowances).toHaveBeenCalledExactlyOnceWith({
      chainId,
      owner: safeAddress,
      pairs: [{ tokenAddress, spender }],
      blockNumber: head,
    });
  });

  it('should, when an allowance is zero, leave its pair out', async () => {
    const head = faker.number.int({ min: 1, max: 20_000_000 });
    const tokenAddress = getAddress(faker.finance.ethereumAddress());
    const spender = getAddress(faker.finance.ethereumAddress());
    const allowance = faker.number.bigInt({ min: 1n });
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(
      rawify([
        erc20ApprovalLogEncoder()
          .with('tokenAddress', tokenAddress)
          .with('owner', safeAddress)
          .with('spender', spender)
          .encode(),
        erc20ApprovalLogEncoder().with('owner', safeAddress).encode(),
      ]),
    );
    tokenApprovalsApi.getAllowances.mockResolvedValue(
      rawify([
        { status: 'success', result: allowance },
        { status: 'success', result: BigInt(0) },
      ]),
    );

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([
      { tokenAddress, spender, allowance },
    ]);
  });

  it('should, when the allowance call of a token fails, leave its pair out', async () => {
    const head = faker.number.int({ min: 1, max: 20_000_000 });
    const tokenAddress = getAddress(faker.finance.ethereumAddress());
    const spender = getAddress(faker.finance.ethereumAddress());
    const allowance = faker.number.bigInt({ min: 1n });
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(
      rawify([
        erc20ApprovalLogEncoder().with('owner', safeAddress).encode(),
        erc20ApprovalLogEncoder()
          .with('tokenAddress', tokenAddress)
          .with('owner', safeAddress)
          .with('spender', spender)
          .encode(),
      ]),
    );
    tokenApprovalsApi.getAllowances.mockResolvedValue(
      rawify([
        { status: 'failure', error: new Error(), result: undefined },
        { status: 'success', result: allowance },
      ]),
    );

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([
      { tokenAddress, spender, allowance },
    ]);
  });

  it('should, when a log is an ERC-721 approval, leave it out', async () => {
    const head = faker.number.int({ min: 1, max: 20_000_000 });
    const tokenAddress = getAddress(faker.finance.ethereumAddress());
    const spender = getAddress(faker.finance.ethereumAddress());
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(
      rawify([
        erc721ApprovalLogEncoder().with('owner', safeAddress).encode(),
        erc20ApprovalLogEncoder()
          .with('tokenAddress', tokenAddress)
          .with('owner', safeAddress)
          .with('spender', spender)
          .encode(),
      ]),
    );
    tokenApprovalsApi.getAllowances.mockResolvedValue(
      rawify([{ status: 'success', result: faker.number.bigInt({ min: 1n }) }]),
    );

    await target.getTokenApprovals({ chainId, safeAddress });

    expect(tokenApprovalsApi.getAllowances).toHaveBeenCalledExactlyOnceWith({
      chainId,
      owner: safeAddress,
      pairs: [{ tokenAddress, spender }],
      blockNumber: head,
    });
  });

  it('should, when the provider rejects the whole range, read it in halves and report the list as complete', async () => {
    const half = faker.number.int({ min: 1, max: 10_000_000 });
    const head = 2 * half - 1;
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs
      .mockRejectedValueOnce(new DataSourceError('Service unavailable', 503))
      .mockResolvedValue(rawify([]));

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({ approvals: [], isComplete: true });
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenCalledTimes(3);
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenNthCalledWith(1, {
      chainId,
      owner: safeAddress,
      fromBlock: 0,
      toBlock: head,
    });
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenNthCalledWith(2, {
      chainId,
      owner: safeAddress,
      fromBlock: 0,
      toBlock: half - 1,
    });
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenNthCalledWith(3, {
      chainId,
      owner: safeAddress,
      fromBlock: half,
      toBlock: head,
    });
    expect(tokenApprovalsApi.setScanState).toHaveBeenCalledExactlyOnceWith({
      chainId,
      safeAddress,
      state: {
        pairs: [],
        lastScannedBlock: head,
        rangeSize: half,
        hasDroppedPairs: false,
      },
    });
  });

  it('should, when the request budget runs out before the latest block, report the list as incomplete and continue after the stored block on the next call', async () => {
    configurationService.set('tokenApprovals.logs.maxRequests', 2);
    const target = new TokenApprovalsRepository(
      configurationService,
      loggingService,
      tokenApprovalsApi,
    );
    const half = faker.number.int({ min: 1, max: 10_000_000 });
    const head = 2 * half - 1;
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.setScanState.mockImplementation(({ state }) => {
      tokenApprovalsApi.getScanState.mockResolvedValue(rawify(state));
      return Promise.resolve();
    });
    tokenApprovalsApi.getApprovalLogs
      .mockRejectedValueOnce(new DataSourceError('Service unavailable', 503))
      .mockResolvedValue(rawify([]));

    const first = await target.getTokenApprovals({ chainId, safeAddress });
    const second = await target.getTokenApprovals({ chainId, safeAddress });

    expect(first.isComplete).toBe(false);
    expect(second.isComplete).toBe(true);
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenCalledTimes(3);
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenNthCalledWith(3, {
      chainId,
      owner: safeAddress,
      fromBlock: half,
      toBlock: head,
    });
  });

  it('should, when a complete scan is stored, read only the blocks added since and keep the stored pairs', async () => {
    const lastScannedBlock = faker.number.int({ min: 1, max: 20_000_000 });
    const rangeSize = faker.number.int({ min: 10, max: 10_000 });
    const head =
      lastScannedBlock + faker.number.int({ min: 1, max: rangeSize });
    const state = tokenApprovalsScanStateBuilder()
      .with('lastScannedBlock', lastScannedBlock)
      .with('rangeSize', rangeSize)
      .build();
    const allowance = faker.number.bigInt({ min: 1n });
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(rawify(state));
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(rawify([]));
    tokenApprovalsApi.getAllowances.mockResolvedValue(
      rawify(state.pairs.map(() => ({ status: 'success', result: allowance }))),
    );

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenCalledExactlyOnceWith({
      chainId,
      owner: safeAddress,
      fromBlock: lastScannedBlock + 1,
      toBlock: head,
    });
    expect(actual).toStrictEqual({
      approvals: state.pairs.map((pair) => ({ ...pair, allowance })),
      isComplete: true,
    });
  });

  it('should, when the Safe has more pairs than the cap, keep the first ones and report the list as incomplete', async () => {
    const maxPairs = faker.number.int({ min: 1, max: 5 });
    configurationService.set('tokenApprovals.maxPairs', maxPairs);
    const target = new TokenApprovalsRepository(
      configurationService,
      loggingService,
      tokenApprovalsApi,
    );
    const head = faker.number.int({ min: 1, max: 20_000_000 });
    const pairs = faker.helpers.multiple(() => tokenSpenderBuilder().build(), {
      count: maxPairs + 1,
    });
    const keptPairs = pairs.slice(0, maxPairs);
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(
      rawify(
        pairs.map((pair) =>
          erc20ApprovalLogEncoder()
            .with('tokenAddress', pair.tokenAddress)
            .with('owner', safeAddress)
            .with('spender', pair.spender)
            .encode(),
        ),
      ),
    );
    tokenApprovalsApi.getAllowances.mockResolvedValue(
      rawify(
        keptPairs.map(() => ({
          status: 'success',
          result: faker.number.bigInt({ min: 1n }),
        })),
      ),
    );

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.isComplete).toBe(false);
    expect(tokenApprovalsApi.getAllowances).toHaveBeenCalledExactlyOnceWith({
      chainId,
      owner: safeAddress,
      pairs: keptPairs,
      blockNumber: head,
    });
    expect(tokenApprovalsApi.setScanState).toHaveBeenCalledExactlyOnceWith({
      chainId,
      safeAddress,
      state: {
        pairs: keptPairs,
        lastScannedBlock: head,
        rangeSize: head + 1,
        hasDroppedPairs: true,
      },
    });
  });

  it('should, when a single block is rejected after earlier blocks were read, keep the progress and report the list as incomplete', async () => {
    const lastScannedBlock = faker.number.int({ min: 1, max: 20_000_000 });
    const state = tokenApprovalsScanStateBuilder()
      .with('pairs', [])
      .with('lastScannedBlock', lastScannedBlock)
      .with('rangeSize', faker.number.int({ min: 2, max: 10_000 }))
      .build();
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(lastScannedBlock + 2)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(rawify(state));
    tokenApprovalsApi.getApprovalLogs
      .mockRejectedValueOnce(new DataSourceError('Service unavailable', 503))
      .mockResolvedValueOnce(rawify([]))
      .mockRejectedValueOnce(new DataSourceError('Service unavailable', 503));

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({ approvals: [], isComplete: false });
    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenCalledTimes(3);
    expect(tokenApprovalsApi.setScanState).toHaveBeenCalledExactlyOnceWith({
      chainId,
      safeAddress,
      state: {
        pairs: [],
        lastScannedBlock: lastScannedBlock + 1,
        rangeSize: 1,
        hasDroppedPairs: false,
      },
    });
  });

  it('should, when not even one block can be read, throw the error of the provider', async () => {
    const error = new DataSourceError('Service unavailable', 503);
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(rawify(BigInt(0)));
    tokenApprovalsApi.getScanState.mockResolvedValue(null);
    tokenApprovalsApi.getApprovalLogs.mockRejectedValue(error);

    await expect(
      target.getTokenApprovals({ chainId, safeAddress }),
    ).rejects.toThrow(error);

    expect(tokenApprovalsApi.setScanState).not.toHaveBeenCalled();
  });

  it('should, when the stored scan state does not parse, scan from the first block', async () => {
    const head = faker.number.int({ min: 1, max: 20_000_000 });
    tokenApprovalsApi.getHeadBlockNumber.mockResolvedValue(
      rawify(BigInt(head)),
    );
    tokenApprovalsApi.getScanState.mockResolvedValue(
      rawify({ lastScannedBlock: faker.string.alpha() }),
    );
    tokenApprovalsApi.getApprovalLogs.mockResolvedValue(rawify([]));

    await target.getTokenApprovals({ chainId, safeAddress });

    expect(tokenApprovalsApi.getApprovalLogs).toHaveBeenCalledExactlyOnceWith({
      chainId,
      owner: safeAddress,
      fromBlock: 0,
      toBlock: head,
    });
  });
});

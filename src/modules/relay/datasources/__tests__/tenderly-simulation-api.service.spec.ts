// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, type Hex, getAddress, toEventSelector } from 'viem';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { TenderlySimulationApi } from '@/modules/relay/datasources/tenderly-simulation-api.service';

const SAFE_EXECUTION_FAILURE_TOPIC = toEventSelector(
  'event ExecutionFailure(bytes32 txHash, uint256 payment)',
).toLowerCase();

const SIMULATION_URL = 'https://simulation.safe.global/';

const mockNetworkService = jest.mocked({
  post: jest.fn(),
} as unknown as jest.MockedObjectDeep<INetworkService>);

const mockPublicClient = jest.mocked({
  getBlock: jest.fn(),
} as unknown);

const mockBlockchainApiManager = jest.mocked({
  getApi: jest.fn(),
} as unknown as jest.MockedObjectDeep<IBlockchainApiManager>);

const mockLoggingService = jest.mocked({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

function fakeAddress(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

function fakeHex(): Hex {
  return `0x${faker.string.hexadecimal({
    length: 64,
    casing: 'lower',
    prefix: '',
  })}`;
}

function fakeArgs(): {
  chainId: string;
  from: Address;
  to: Address;
  data: Hex;
} {
  return {
    chainId: faker.string.numeric(),
    from: fakeAddress(),
    to: fakeAddress(),
    data: fakeHex(),
  };
}

function simulationResponse(args: {
  status: boolean;
  errorMessage?: string;
  topics?: Array<Array<string>>;
}): unknown {
  return {
    transaction: {
      status: args.status,
      ...(args.errorMessage ? { error_message: args.errorMessage } : {}),
      transaction_info: {
        logs: (args.topics ?? []).map((topics) => ({ raw: { topics } })),
      },
    },
  };
}

describe('TenderlySimulationApi', () => {
  let target: TenderlySimulationApi;
  let blockGasLimit: bigint;

  beforeEach(() => {
    jest.resetAllMocks();

    blockGasLimit = BigInt(faker.number.int({ min: 30_000_000, max: 50_000_000 }));
    (mockPublicClient.getBlock as jest.Mock).mockResolvedValue({
      gasLimit: blockGasLimit,
    });
    mockBlockchainApiManager.getApi.mockResolvedValue(
      mockPublicClient as never,
    );

    target = new TenderlySimulationApi(
      mockNetworkService,
      mockBlockchainApiManager,
      mockLoggingService,
    );
  });

  describe('simulate', () => {
    it('returns success and posts the expected payload when the simulation succeeds', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({ status: true }),
      } as never);

      const result = await target.simulate(args);

      expect(result).toEqual({ success: true });
      expect(mockBlockchainApiManager.getApi).toHaveBeenCalledWith(args.chainId);
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: SIMULATION_URL,
        data: {
          network_id: args.chainId,
          from: args.from,
          to: args.to,
          input: args.data,
          value: '0',
          gas: blockGasLimit.toString(),
          gas_price: '0',
          save: true,
          save_if_fails: true,
        },
      });
      expect(mockLoggingService.warn).not.toHaveBeenCalled();
    });

    it('serialises a non-zero `value` as a decimal string', async () => {
      const args = { ...fakeArgs(), value: 123_456_789n };
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({ status: true }),
      } as never);

      await target.simulate(args);

      expect(mockNetworkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ value: '123456789' }),
        }),
      );
    });

    it('returns failure with the provider error_message when status is false', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({
          status: false,
          errorMessage: "Reverted with reason string: 'GS013'",
        }),
      } as never);

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: "Reverted with reason string: 'GS013'",
      });
    });

    it('falls back to a generic reason when status is false without error_message', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({ status: false }),
      } as never);

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: 'Transaction would revert',
      });
    });

    it('detects ExecutionFailure logs even when status is true', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({
          status: true,
          topics: [
            [faker.string.hexadecimal({ length: 64, casing: 'lower' })],
            [SAFE_EXECUTION_FAILURE_TOPIC],
          ],
        }),
      } as never);

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: 'Safe execTransaction emitted ExecutionFailure',
      });
    });

    it('matches the ExecutionFailure topic case-insensitively', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({
          status: true,
          topics: [[SAFE_EXECUTION_FAILURE_TOPIC.toUpperCase()]],
        }),
      } as never);

      const result = await target.simulate(args);

      expect(result.success).toBe(false);
    });

    it('returns success when none of the log topics is ExecutionFailure', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({
          status: true,
          topics: [
            [faker.string.hexadecimal({ length: 64, casing: 'lower' })],
            [faker.string.hexadecimal({ length: 64, casing: 'lower' })],
          ],
        }),
      } as never);

      const result = await target.simulate(args);

      expect(result).toEqual({ success: true });
    });

    it('fails closed and logs at error level when the response does not match the schema', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: { unexpected: 'shape' },
      } as never);

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: 'Simulation request failed',
      });
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Tenderly simulation response schema mismatch for ${args.to} on chain ${args.chainId}`,
        ),
      );
      expect(mockLoggingService.warn).not.toHaveBeenCalled();
    });

    it('fails closed and logs the HTTP status when Tenderly returns an error response', async () => {
      const args = fakeArgs();
      const url = new URL(SIMULATION_URL);
      const response = { status: 502 } as Response;
      mockNetworkService.post.mockRejectedValue(
        new NetworkResponseError(url, response, { error: 'bad gateway' }),
      );

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: 'Simulation request failed',
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 502'),
      );
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('bad gateway'),
      );
    });

    it('fails closed and surfaces the underlying cause when the request never completes', async () => {
      const args = fakeArgs();
      const url = new URL(SIMULATION_URL);
      const cause = new Error('getaddrinfo ENOTFOUND simulation.safe.global');
      const transportError = new TypeError('fetch failed');
      (transportError as Error & { cause?: unknown }).cause = cause;
      mockNetworkService.post.mockRejectedValue(
        new NetworkRequestError(url, transportError),
      );

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: 'Simulation request failed',
      });
      const warn = mockLoggingService.warn.mock.calls[0][0] as string;
      expect(warn).toContain('TypeError: fetch failed');
      expect(warn).toContain('ENOTFOUND simulation.safe.global');
    });

    it('caches the latest block gas limit per chain and reuses it within the TTL', async () => {
      const args = fakeArgs();
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({ status: true }),
      } as never);

      await target.simulate(args);
      await target.simulate(args);

      expect(mockPublicClient.getBlock as jest.Mock).toHaveBeenCalledTimes(1);
      expect(mockBlockchainApiManager.getApi).toHaveBeenCalledTimes(1);
    });

    it('refetches the block gas limit when the cache entry has expired', async () => {
      jest.useFakeTimers();
      try {
        const args = fakeArgs();
        mockNetworkService.post.mockResolvedValue({
          status: 200,
          data: simulationResponse({ status: true }),
        } as never);

        await target.simulate(args);
        jest.advanceTimersByTime(31_000);
        await target.simulate(args);

        expect(mockPublicClient.getBlock as jest.Mock).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps separate cache entries per chain', async () => {
      const argsA = { ...fakeArgs(), chainId: '1' };
      const argsB = { ...fakeArgs(), chainId: '137' };
      mockNetworkService.post.mockResolvedValue({
        status: 200,
        data: simulationResponse({ status: true }),
      } as never);

      await target.simulate(argsA);
      await target.simulate(argsB);

      expect(mockPublicClient.getBlock as jest.Mock).toHaveBeenCalledTimes(2);
      expect(mockBlockchainApiManager.getApi).toHaveBeenNthCalledWith(1, '1');
      expect(mockBlockchainApiManager.getApi).toHaveBeenNthCalledWith(2, '137');
    });

    it('fails closed when the latest block gas limit cannot be fetched', async () => {
      const args = fakeArgs();
      (mockPublicClient.getBlock as jest.Mock).mockRejectedValue(
        new Error('RPC unreachable'),
      );

      const result = await target.simulate(args);

      expect(result).toEqual({
        success: false,
        reason: 'Simulation request failed',
      });
      expect(mockNetworkService.post).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('RPC unreachable'),
      );
    });
  });
});

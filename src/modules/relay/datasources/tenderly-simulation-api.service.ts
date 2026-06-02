// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, toEventSelector } from 'viem';
import { ZodError } from 'zod';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IBlockchainApiManager as IBlockchainApiManagerType } from '@/domain/interfaces/blockchain-api.manager.interface';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import type {
  ITenderlySimulationApi,
  TenderlySimulationResult,
} from '@/domain/interfaces/tenderly-simulation-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { TenderlySimulationResponseSchema } from '@/modules/relay/datasources/schemas/tenderly-simulation.schema';

/**
 * Public Tenderly proxy used by the Safe frontend. No auth required and the
 * response is the standard Tenderly simulation payload.
 */
const SIMULATION_URL = 'https://simulation.safe.global/';


function formatNetworkError(error: unknown): string {
  if (error instanceof NetworkResponseError) {
    return `HTTP ${error.response.status} from ${error.url.toString()} — body=${JSON.stringify(error.data)}`;
  }
  if (error instanceof NetworkRequestError) {
    const url = error.url?.toString() ?? '<unknown>';
    return `network request error to ${url} — ${formatErrorCause(error.data)}`;
  }
  if (error instanceof Error) {
    return formatError(error);
  }
  return JSON.stringify(error);
}

function formatErrorCause(cause: unknown): string {
  if (!(cause instanceof Error)) {
    return JSON.stringify(cause);
  }
  const nested =
    'cause' in cause && cause.cause ? ` (cause: ${formatCause(cause.cause)})` : '';
  return `${formatError(cause)}${nested}`;
}

function formatCause(cause: unknown): string {
  return cause instanceof Error
    ? `${cause.name}: ${cause.message}`
    : String(cause);
}

function formatError(error: Error): string {
  const stack = error.stack ? `\n${error.stack}` : '';
  return `${error.name}: ${error.message}${stack}`;
}

/**
 * Topic for the Safe's `ExecutionFailure(bytes32 txHash, uint256 payment)`
 * event. When `execTransaction` runs with `gasPrice > 0` and the inner call
 * fails, the outer transaction succeeds (so `transaction.status` is `true`),
 * so we must inspect the logs to detect this case.
 */
const SAFE_EXECUTION_FAILURE_TOPIC = toEventSelector(
  'event ExecutionFailure(bytes32 txHash, uint256 payment)',
).toLowerCase();

/**
 * Block gas limits change slowly relative to the relay request rate, so we
 * cache them per chain with a short TTL to avoid one RPC roundtrip per
 * simulation. 30s is well below any realistic gas limit change cadence.
 */
const BLOCK_GAS_LIMIT_TTL_MS = 30_000;

@Injectable()
export class TenderlySimulationApi implements ITenderlySimulationApi {
  private readonly blockGasLimitCache = new Map<
    string,
    { gasLimit: bigint; expiresAt: number }
  >();

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManagerType,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  private async getLatestBlockGasLimit(chainId: string): Promise<bigint> {
    const cached = this.blockGasLimitCache.get(chainId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.gasLimit;
    }
    const client = await this.blockchainApiManager.getApi(chainId);
    const block = await client.getBlock({ blockTag: 'latest' });
    this.blockGasLimitCache.set(chainId, {
      gasLimit: block.gasLimit,
      expiresAt: Date.now() + BLOCK_GAS_LIMIT_TTL_MS,
    });
    return block.gasLimit;
  }

  async simulate(args: {
    chainId: string;
    from: Address;
    to: Address;
    data: Hex;
    value?: bigint;
  }): Promise<TenderlySimulationResult> {
    try {
      // Always use the latest block gas limit as the simulation budget; the
      // relay request's `gasLimit` is what Gelato will use on-chain and is
      // typically too tight to cover the simulation's overhead (refund path,
      // etc.). Mirrors what the Safe frontend does when no explicit
      // simulation gas budget is supplied. Serialised as a decimal string to
      // avoid a lossy bigint → Number cast for chains with very large gas
      // limits.
      const gas = (await this.getLatestBlockGasLimit(args.chainId)).toString();
      const { data: raw } = await this.networkService.post<unknown>({
        url: SIMULATION_URL,
        data: {
          network_id: args.chainId,
          from: args.from,
          to: args.to,
          input: args.data,
          value: (args.value ?? 0n).toString(),
          gas,
          gas_price: '0',
          save: false,
          save_if_fails: true,
        },
      });

      const parsed = TenderlySimulationResponseSchema.parse(raw);
      if (!parsed.transaction.status) {
        return {
          success: false,
          reason:
            parsed.transaction.error_message ?? 'Transaction would revert',
        };
      }

      // execTransaction with `gasPrice > 0` does not revert when the inner
      // call fails; it emits `ExecutionFailure` and returns success. Detect it
      // from the logs so we still block the relay in that case.
      const logs = parsed.transaction.transaction_info?.logs ?? [];
      const hasExecutionFailure = logs.some((log) =>
        log.raw?.topics?.some(
          (topic) => topic.toLowerCase() === SAFE_EXECUTION_FAILURE_TOPIC,
        ),
      );
      if (hasExecutionFailure) {
        return {
          success: false,
          reason: 'Safe execTransaction emitted ExecutionFailure',
        };
      }

      return { success: true };
    } catch (error) {
      if (error instanceof ZodError) {
        // Schema mismatch — Tenderly likely changed their response shape.
        // Logged at `error` (not `warn`) so it's distinguishable from
        // transient network failures and can be alerted on.
        this.loggingService.error(
          `Tenderly simulation response schema mismatch for ${args.to} on chain ${args.chainId}: ${formatError(error)}`,
        );
      } else {
        this.loggingService.warn(
          `Tenderly simulation failed for ${args.to} on chain ${args.chainId}: ${formatNetworkError(error)}`,
        );
      }
      return { success: false, reason: 'Simulation request failed' };
    }
  }
}

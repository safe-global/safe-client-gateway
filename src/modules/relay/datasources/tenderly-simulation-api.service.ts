// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, toEventSelector } from 'viem';
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

/**
 * Topic for the Safe's `ExecutionFailure(bytes32 txHash, uint256 payment)`
 * event. When `execTransaction` runs with `gasPrice > 0` and the inner call
 * fails, the outer transaction succeeds (so `transaction.status` is `true`),
 * so we must inspect the logs to detect this case.
 */
const SAFE_EXECUTION_FAILURE_TOPIC = toEventSelector(
  'event ExecutionFailure(bytes32 txHash, uint256 payment)',
).toLowerCase();

@Injectable()
export class TenderlySimulationApi implements ITenderlySimulationApi {
  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManagerType,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  private async getLatestBlockGasLimit(chainId: string): Promise<bigint> {
    const client = await this.blockchainApiManager.getApi(chainId);
    const block = await client.getBlock({ blockTag: 'latest' });
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
      // simulation gas budget is supplied.
      const gas = Number(await this.getLatestBlockGasLimit(args.chainId));
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
          save: true,
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
      let details: string;
      if (error instanceof NetworkResponseError) {
        details = `HTTP ${error.response.status} from ${error.url.toString()} — body=${JSON.stringify(error.data)}`;
      } else if (error instanceof NetworkRequestError) {
        const cause = error.data;
        const causeStr =
          cause instanceof Error
            ? `${cause.name}: ${cause.message}${
                'cause' in cause && cause.cause
                  ? ` (cause: ${cause.cause instanceof Error ? `${cause.cause.name}: ${cause.cause.message}` : String(cause.cause)})`
                  : ''
              }${cause.stack ? `\n${cause.stack}` : ''}`
            : JSON.stringify(cause);
        details = `network request error to ${error.url?.toString() ?? '<unknown>'} — ${causeStr}`;
      } else if (error instanceof Error) {
        details = `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
      } else {
        details = JSON.stringify(error);
      }
      this.loggingService.warn(
        `Tenderly simulation failed for ${args.to} on chain ${args.chainId}: ${details}`,
      );
      return { success: false, reason: 'Simulation request failed' };
    }
  }
}

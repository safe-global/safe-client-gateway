// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { formatRhinestoneError } from '@/modules/relay/datasources/helpers/rhinestone-error.helper';
import {
  type Relay,
  type RhinestoneRelayResponse,
  RhinestoneRelayResponseSchema,
} from '@/modules/relay/domain/entities/relay.entity';
import {
  type RelayTaskStatus,
  type RhinestoneTaskStatusResponse,
  RhinestoneTaskStatusResponseSchema,
} from '@/modules/relay/domain/entities/relay-task-status.entity';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

@Injectable()
export class RhinestoneApi implements IRelayApi {
  private readonly baseUri: string;
  private readonly apiKey: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('relay.baseUri');
    this.apiKey = this.configurationService.getOrThrow<string>('relay.apiKey');
  }

  private headers(): Record<string, string> {
    return { 'x-api-key': this.apiKey };
  }

  /**
   * Submits a pre-signed Safe transaction to Rhinestone for sponsored relay.
   *
   * @param args.safeTxHash - Taken from the relay request and forwarded as
   *   received. This gateway does not verify it here, and it is not verified
   *   on every path: only the relay-fee relayer checks the hash against the
   *   submitted calldata, via `RelayTransactionHelper.isSafeTxHashValid`.
   *   Requests routed to the daily-limit and no-fee-campaign relayers forward
   *   whatever the caller sent, including `undefined` and including a value
   *   that does not correspond to `data` — multiSend batches and factory
   *   deployments (createProxyWithNonce / createSigner) have no single SafeTx
   *   hash at all. Treat it as caller-supplied metadata, not a trusted input:
   *   what is actually executed is determined by `to` and `data`.
   */
  async relay(args: {
    chainId: string;
    to: Address;
    data: string;
    safeTxHash?: Hex;
  }): Promise<Raw<Relay>> {
    try {
      const { data } = await this.networkService.post<RhinestoneRelayResponse>({
        url: `${this.baseUri}/safe-transactions`,
        data: {
          chainId: Number(args.chainId),
          to: args.to,
          data: args.data,
          safeTxHash: args.safeTxHash,
        },
        networkRequest: {
          headers: this.headers(),
        },
      });
      const response = RhinestoneRelayResponseSchema.parse(data);
      return rawify({ taskId: response.taskId });
    } catch (error) {
      this.loggingService.error(
        `Error relaying transaction for chain ${args.chainId}: ${formatRhinestoneError(error)}`,
      );
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Retrieves the status of a relay task from Rhinestone.
   */
  async getTaskStatus(args: {
    chainId: string;
    taskId: string;
  }): Promise<Raw<RelayTaskStatus>> {
    try {
      const url = `${this.baseUri}/safe-transactions/${encodeURIComponent(args.taskId)}/status`;
      const { data } =
        await this.networkService.get<RhinestoneTaskStatusResponse>({
          url,
          networkRequest: {
            headers: this.headers(),
          },
        });

      const response = RhinestoneTaskStatusResponseSchema.parse(data);
      return rawify({
        chainId: args.chainId,
        id: response.taskId,
        status: response.status,
        receipt: response.transactionHash
          ? { transactionHash: response.transactionHash }
          : undefined,
      });
    } catch (error) {
      this.loggingService.error(
        `Error getting task status ${args.taskId} for chain ${args.chainId}: ${formatRhinestoneError(error)}`,
      );
      throw this.httpErrorFactory.from(error);
    }
  }

  async getRelayCount(args: {
    chainId: string;
    address: Address;
  }): Promise<number> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    const count = await this.cacheService.hGet(cacheDir);
    return count ? Number.parseInt(count, 10) : 0;
  }

  async setRelayCount(args: {
    chainId: string;
    address: Address;
    count: number;
    ttlSeconds: number;
  }): Promise<void> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    await this.cacheService.hSet(
      cacheDir,
      args.count.toString(),
      args.ttlSeconds,
    );
  }
}

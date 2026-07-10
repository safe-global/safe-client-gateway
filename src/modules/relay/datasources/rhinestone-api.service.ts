// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from "@nestjs/common";
import type { Address, Hex } from "viem";
import { IConfigurationService } from "@/config/configuration.service.interface";
import { CacheRouter } from "@/datasources/cache/cache.router";
import {
  CacheService,
  type ICacheService,
} from "@/datasources/cache/cache.service.interface";
import { HttpErrorFactory } from "@/datasources/errors/http-error-factory";
import { NetworkResponseError } from "@/datasources/network/entities/network.error.entity";
import {
  type INetworkService,
  NetworkService,
} from "@/datasources/network/network.service.interface";
import type { IRelayApi } from "@/domain/interfaces/relay-api.interface";
import {
  type ILoggingService,
  LoggingService,
} from "@/logging/logging.interface";
import { asError } from "@/logging/utils";
import {
  type Relay,
  type RhinestoneRelayResponse,
  RhinestoneRelayResponseSchema,
} from "@/modules/relay/domain/entities/relay.entity";
import {
  type RelayTaskStatus,
  type RhinestoneTaskStatusResponse,
  RhinestoneTaskStatusResponseSchema,
} from "@/modules/relay/domain/entities/relay-task-status.entity";

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
      this.configurationService.getOrThrow<string>("relay.baseUri");
    this.apiKey = this.configurationService.getOrThrow<string>("relay.apiKey");
  }

  private headers(): Record<string, string> {
    return { "x-api-key": this.apiKey };
  }

  /**
   * Builds a log-friendly error string. For a {@link NetworkResponseError}
   * (e.g. Rhinestone's 400 on validation / insufficient sponsorship budget /
   * chain disabled) it surfaces the HTTP status and response body, which carry
   * the human-readable reason — otherwise the message is empty and undiagnosable.
   */
  private formatError(error: unknown): string {
    if (error instanceof NetworkResponseError) {
      const body =
        typeof error.data === "string"
          ? error.data
          : JSON.stringify(error.data);
      return `status=${error.response.status} body=${body}`;
    }
    return asError(error).message;
  }

  /**
   * Submits a pre-signed Safe transaction to Rhinestone for sponsored relay.
   * @param args.safeTxHash - Required for execTransaction; omitted for
   *   multiSend batches and factory deployments (createProxyWithNonce /
   *   createSigner), which have no single SafeTx hash.
   */
  async relay(args: {
    chainId: string;
    to: Address;
    data: string;
    safeTxHash?: Hex;
  }): Promise<Relay> {
    const url = `${this.baseUri}/safe-transactions`;
    const body = {
      chainId: Number(args.chainId),
      to: args.to,
      data: args.data,
      safeTxHash: args.safeTxHash,
    };

    try {
      const { data } = await this.networkService.post<RhinestoneRelayResponse>({
        url,
        data: body,
        networkRequest: {
          headers: this.headers(),
        },
      });
      const response = RhinestoneRelayResponseSchema.parse(data);
      return { taskId: response.taskId };
    } catch (error) {
      this.loggingService.error(
        `Error relaying transaction for chain ${args.chainId}: ${this.formatError(error)}`,
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
  }): Promise<RelayTaskStatus> {
    try {
      const url = `${this.baseUri}/safe-transactions/${args.taskId}/status`;
      const { data } =
        await this.networkService.get<RhinestoneTaskStatusResponse>({
          url,
          networkRequest: {
            headers: this.headers(),
          },
        });

      const response = RhinestoneTaskStatusResponseSchema.parse(data);
      return {
        chainId: args.chainId,
        id: response.taskId,
        status: response.status,
        receipt: response.transactionHash
          ? { transactionHash: response.transactionHash }
          : undefined,
      };
    } catch (error) {
      this.loggingService.error(
        `Error getting task status ${args.taskId} for chain ${args.chainId}: ${this.formatError(error)}`,
      );
      throw this.httpErrorFactory.from(error);
    }
  }

  async getRelayCount(args: {
    chainId: string;
    address: Address;
    // TODO: Change to Raw when cache service is migrated
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

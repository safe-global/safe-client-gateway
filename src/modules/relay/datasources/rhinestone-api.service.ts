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
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { RhinestoneErrorResponseSchema } from '@/modules/relay/datasources/schemas/rhinestone-error.schema';
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

/**
 * Cap on how many of a Rhinestone error body's `errors[]` entries are copied
 * into a log line. Rhinestone can report several validation failures at once;
 * the first few carry the diagnosis, the rest would only bloat the entry.
 */
const MAX_LOGGED_UPSTREAM_ERRORS = 3;

/**
 * Per-message character cap for upstream-controlled strings copied into a log
 * line, so a long or hostile body cannot flood log storage.
 */
const MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH = 200;

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
   * Builds a log-friendly error string.
   *
   * Both network error classes extend {@link Error} without setting a message,
   * so `asError(error).message` alone is empty and undiagnosable. This surfaces
   * the HTTP status (or the target URL, when no response was received), plus
   * the whitelisted diagnostic fields of the response body — see
   * {@link describeUpstreamError} for what is and is not copied out of it.
   */
  private formatError(error: unknown): string {
    if (error instanceof NetworkResponseError) {
      return `status=${error.response.status} ${error.response.statusText}${this.describeUpstreamError(error.data)}`;
    }
    if (error instanceof NetworkRequestError) {
      return `no response received from ${error.url}`;
    }
    return asError(error).message;
  }

  /**
   * Extracts the loggable part of a Rhinestone error body.
   *
   * Rhinestone nests its rejection reason under `errors[].message`, which
   * {@link HttpErrorFactory} cannot see (it reads only `data.message`), so
   * without this the reason — e.g. "`to` is not a canonical Safe proxy
   * factory" — is discarded and the failure is undiagnosable from logs alone.
   *
   * The body is not logged wholesale: only `errors[].message` and `traceId`
   * are copied, per the structured-logging rule in `docs/agents/security.md`.
   * The `errors[].context` object is dropped — it echoes back request details
   * (chain ID, addresses) that do not belong in log storage. Messages are
   * whitespace-collapsed and length-capped so an upstream-controlled string
   * cannot forge additional log lines or flood a log entry.
   *
   * @returns a leading-space-prefixed fragment ready to append to a log line,
   * or an empty string when the body carries nothing loggable.
   */
  private describeUpstreamError(data: unknown): string {
    const parsed = RhinestoneErrorResponseSchema.safeParse(data);
    if (!parsed.success) {
      return '';
    }

    const messages = (parsed.data.errors ?? [])
      .slice(0, MAX_LOGGED_UPSTREAM_ERRORS)
      .map((error) => this.truncateForLog(error.message))
      .filter((message) => message.length > 0);

    const fragments: Array<string> = [];
    if (messages.length > 0) {
      fragments.push(`upstreamErrors="${messages.join('; ')}"`);
    }
    if (parsed.data.traceId) {
      fragments.push(`traceId=${this.truncateForLog(parsed.data.traceId)}`);
    }

    return fragments.length > 0 ? ` ${fragments.join(' ')}` : '';
  }

  /**
   * Collapses whitespace (including newlines, which would otherwise let an
   * upstream string forge log lines) and caps length.
   */
  private truncateForLog(value: string): string {
    const collapsed = value.replace(/\s+/g, ' ').trim();
    return collapsed.length > MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH
      ? `${collapsed.slice(0, MAX_LOGGED_UPSTREAM_MESSAGE_LENGTH)}…`
      : collapsed;
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
  }): Promise<Relay> {
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
      const url = `${this.baseUri}/safe-transactions/${encodeURIComponent(args.taskId)}/status`;
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

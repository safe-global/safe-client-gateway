// SPDX-License-Identifier: FSL-1.1-MIT

import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  type McpElevationRequest,
  McpElevationRequestSchema,
} from '@/modules/auth/mcp/domain/entities/mcp-elevation-request.entity';
import type { IMcpElevationRepository } from '@/modules/auth/mcp/domain/mcp-elevation.repository.interface';

@Injectable()
export class McpElevationRepository implements IMcpElevationRepository {
  private readonly requestTtlSeconds: number;
  private readonly elevationWindowSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    // A step-up link lives as long as the OIDC round-trip it starts.
    this.requestTtlSeconds = Math.ceil(
      configurationService.getOrThrow<number>('auth.stateTtlMs') / 1_000,
    );
    this.elevationWindowSeconds = configurationService.getOrThrow<number>(
      'auth.elevationWindowSeconds',
    );
  }

  async createRequest(request: McpElevationRequest): Promise<string> {
    const requestId = randomBytes(32).toString('hex');
    await this.cacheService.hSet(
      CacheRouter.getMcpElevationRequestCacheDir(requestId),
      JSON.stringify(McpElevationRequestSchema.parse(request)),
      this.requestTtlSeconds,
    );
    return requestId;
  }

  async consumeRequest(requestId: string): Promise<McpElevationRequest | null> {
    const cacheDir = CacheRouter.getMcpElevationRequestCacheDir(requestId);
    const cached = await this.cacheService.hGet(cacheDir);
    if (!cached) {
      return null;
    }
    // Only the caller whose delete removed the key may use it, so two
    // concurrent completions of the same link cannot both succeed.
    const deleted = await this.cacheService.deleteByKey(cacheDir.key);
    if (deleted !== 1) {
      return null;
    }
    return McpElevationRequestSchema.parse(JSON.parse(cached));
  }

  async setElevated(
    args: McpElevationRequest & { verifiedAt: number },
  ): Promise<void> {
    await this.cacheService.hSet(
      CacheRouter.getMcpElevationCacheDir(args),
      args.verifiedAt.toString(),
      this.elevationWindowSeconds,
    );
  }

  async getElevatedAt(args: McpElevationRequest): Promise<number | null> {
    const cached = await this.cacheService.hGet(
      CacheRouter.getMcpElevationCacheDir(args),
    );
    if (!cached) {
      return null;
    }
    return z.coerce.number().int().nonnegative().parse(cached);
  }
}

// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { ResolvedEntitlements } from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';
import { IEntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository.interface';
import type {
  EntitlementsResponse,
  OverSeatSafe,
} from '@/modules/entitlements/routes/entities/entitlements-response.entity';
import type { UpdateSeatSelectionDto } from '@/modules/entitlements/routes/entities/update-seat-selection.dto.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  assertAdmin,
  assertMember,
} from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class EntitlementsService {
  private readonly cacheExpirationTimeInSeconds: number;

  public constructor(
    @Inject(IEntitlementsRepository)
    private readonly entitlementsRepository: IEntitlementsRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.cacheExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.entitlements',
      );
  }

  public async getEntitlements(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
  }): Promise<EntitlementsResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const resolved = await this.getResolvedEntitlements(args.spaceId);
    return await this.toResponse(resolved);
  }

  public async updateSeatSelection(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: UpdateSeatSelectionDto;
  }): Promise<EntitlementsResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.spacesRepository, args.spaceId, userId);

    // Uncached read: the mutation validates against authoritative state.
    const resolved = await this.entitlementsRepository.resolveEntitlements(
      args.spaceId,
    );
    const seats = resolved.entitlements.find(
      (entitlement) => entitlement.feature === 'safe_seats',
    );
    if (seats?.type !== 'metered' || typeof seats.quota !== 'number') {
      throw new BadRequestException(
        'Seat selection is not applicable: Safe seats are not limited on the current plan.',
      );
    }
    if (seats.grandfathered) {
      throw new ConflictException(
        'Seat selection does not apply to grandfathered workspaces.',
      );
    }
    if (args.payload.safes.length > seats.quota) {
      throw new BadRequestException(
        `At most ${seats.quota} Safes can be covered by the current plan.`,
      );
    }

    const resolvedSafes = await this.spaceSafesRepository.resolveIds({
      spaceId: args.spaceId,
      payload: args.payload.safes,
    });
    if (resolvedSafes.length !== args.payload.safes.length) {
      const foundKeys = new Set(
        resolvedSafes.map((safe) => `${safe.chainId}:${safe.address}`),
      );
      const missing = args.payload.safes
        .filter((safe) => !foundKeys.has(`${safe.chainId}:${safe.address}`))
        .map((safe) => `${safe.chainId}:${safe.address}`);
      throw new UnprocessableEntityException(
        `Safes not in this workspace: ${missing.join(', ')}`,
      );
    }

    await this.entitlementsRepository.replaceSeatSelection({
      spaceId: args.spaceId,
      spaceSafeIds: resolvedSafes.map((safe) => safe.id),
    });
    await this.cacheService.deleteByKey(
      CacheRouter.getSpaceEntitlementsCacheKey(args.spaceId),
    );

    // Return the recomputed state so the client re-renders coverage without
    // a second GET.
    return await this.toResponse(
      await this.getResolvedEntitlements(args.spaceId),
    );
  }

  private async getResolvedEntitlements(
    spaceId: Space['id'],
  ): Promise<ResolvedEntitlements> {
    const cacheDir = CacheRouter.getSpaceEntitlementsCacheDir(spaceId);
    const cached = await this.cacheService.hGet(cacheDir);
    if (cached != null) {
      // Dates round-trip as ISO strings; toResponse serializes them anyway.
      return JSON.parse(cached) as ResolvedEntitlements;
    }

    const resolved =
      await this.entitlementsRepository.resolveEntitlements(spaceId);
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(resolved),
      this.cacheExpirationTimeInSeconds,
    );
    return resolved;
  }

  private async toResponse(
    resolved: ResolvedEntitlements,
  ): Promise<EntitlementsResponse> {
    return {
      plan: resolved.plan
        ? {
            id: resolved.plan.id,
            name: resolved.plan.name,
            cycleEndsAt: this.toIso(resolved.plan.cycleEndsAt),
          }
        : null,
      entitlements: resolved.entitlements.map((entitlement) => ({
        feature: entitlement.feature,
        type: entitlement.type,
        enabled: entitlement.enabled,
        ...(entitlement.quota !== undefined && { quota: entitlement.quota }),
        ...(entitlement.used !== undefined && { used: entitlement.used }),
        ...(entitlement.resetsAt !== undefined && {
          resetsAt: this.toIso(entitlement.resetsAt),
        }),
        ...(entitlement.grandfathered !== undefined && {
          grandfathered: entitlement.grandfathered,
        }),
        ...(entitlement.value !== undefined && { value: entitlement.value }),
      })),
      overSeatSafes: await this.getOverSeatSafes(resolved.overSeatSafeIds),
    };
  }

  private async getOverSeatSafes(
    overSeatSafeIds: Array<number>,
  ): Promise<Array<OverSeatSafe>> {
    if (overSeatSafeIds.length === 0) {
      return [];
    }
    // The space relation is required by the repository's decryption boundary.
    const safes = await this.spaceSafesRepository.find({
      where: { id: In(overSeatSafeIds) },
      relations: { space: true },
    });
    return safes.map((safe) => ({
      chainId: safe.chainId,
      address: safe.address,
    }));
  }

  private toIso(value: Date | string | null): string | null {
    if (value === null) {
      return null;
    }
    return value instanceof Date ? value.toISOString() : value;
  }
}

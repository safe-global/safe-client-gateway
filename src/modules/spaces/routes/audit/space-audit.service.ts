// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { SpaceAuditLog } from '@/modules/spaces/datasources/audit/entities/space-audit-log.entity.db';
import {
  SpaceAuditEventSchema,
  type SpaceAuditEventType,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';
import type {
  SpaceAuditLogActorDto,
  SpaceAuditLogEntryDto,
  SpaceAuditLogPage,
} from '@/modules/spaces/routes/audit/entities/space-audit-log.dto.entity';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver/user-identity-resolver.service';
import {
  buildNextPageURL,
  buildPreviousPageURL,
  PaginationData,
  setCursor,
} from '@/routes/common/pagination/pagination.data';

export const FORMER_MEMBER_LABEL = 'Former member';

const MAX_LIMIT = 100;

export type SpaceAuditLogFilters = {
  eventTypes?: Array<keyof typeof SpaceAuditEventType>;
  actorUserId?: number;
  createdAtGte?: Date;
  createdAtLte?: Date;
  sortDirection?: 'asc' | 'desc';
};

@Injectable()
export class SpaceAuditService {
  constructor(
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(UserIdentityResolverService)
    private readonly identityResolver: UserIdentityResolverService,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {}

  public async getAuditLog(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    routeUrl: URL;
    paginationData: PaginationData;
    filters: SpaceAuditLogFilters;
  }): Promise<SpaceAuditLogPage> {
    const viewerIsActiveAdmin = await this.assertViewer(args);

    const limit = Math.min(args.paginationData.limit, MAX_LIMIT);
    const offset = Math.max(args.paginationData.offset, 0);
    // Page links must be derived from the clamped values, not the raw cursor.
    const normalizedUrl = setCursor(
      args.routeUrl,
      new PaginationData(limit, offset),
    );

    const [rows, count] = await this.spaceAuditRepository.findBySpaceId({
      spaceId: args.spaceId,
      limit,
      offset,
      ...args.filters,
    });

    const display = await this.buildDisplayResolver({
      spaceId: args.spaceId,
      viewerIsActiveAdmin,
      subjectIds: rows.flatMap((row) => {
        const targetUserId = getTargetUserId(row.payload);
        return targetUserId === null
          ? [row.actorUserId]
          : [row.actorUserId, targetUserId];
      }),
    });

    return {
      count,
      next: buildNextPageURL(normalizedUrl, count)?.toString() ?? null,
      previous: buildPreviousPageURL(normalizedUrl)?.toString() ?? null,
      results: await Promise.all(
        rows.map((row) => this.toEntryDto(args.spaceId, row, display)),
      ),
    };
  }

  public async getAuditLogActors(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<SpaceAuditLogActorDto>> {
    const viewerIsActiveAdmin = await this.assertViewer(args);

    const actorIds = await this.spaceAuditRepository.findDistinctActorIds(
      args.spaceId,
    );

    const display = await this.buildDisplayResolver({
      spaceId: args.spaceId,
      viewerIsActiveAdmin,
      subjectIds: actorIds,
    });

    return actorIds.map((actorUserId) => ({
      actorUserId,
      actor: display(actorUserId),
    }));
  }

  private async assertViewer(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<boolean> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const viewer = await assertMember(
      this.membersRepository,
      args.spaceId,
      userId,
    );
    return viewer.role === 'ADMIN';
  }

  /**
   * Email display strings are only exposed when the subject is an ACTIVE
   * member or the viewer is an active admin (mirrors the members endpoint);
   * otherwise {@link FORMER_MEMBER_LABEL} is substituted.
   */
  private async buildDisplayResolver(args: {
    spaceId: Space['id'];
    viewerIsActiveAdmin: boolean;
    subjectIds: Array<number>;
  }): Promise<(userId: number) => string> {
    const [identityMap, activeMemberUserIds] = await Promise.all([
      this.identityResolver.resolveMany(args.subjectIds),
      this.findActiveMemberUserIds(args.spaceId),
    ]);

    return (userId: number): string => {
      const resolved =
        identityMap.get(userId) ??
        UserIdentityResolverService.DELETED_USER_LABEL;
      const isEmail = resolved.includes('@');
      if (
        isEmail &&
        !activeMemberUserIds.has(userId) &&
        !args.viewerIsActiveAdmin
      ) {
        return FORMER_MEMBER_LABEL;
      }
      return resolved;
    };
  }

  private async findActiveMemberUserIds(
    spaceId: Space['id'],
  ): Promise<Set<number>> {
    const members = await this.membersRepository.find({
      where: { space: { id: spaceId }, status: 'ACTIVE' },
      relations: { user: true },
      select: { id: true, user: { id: true } },
    });
    return new Set(members.map((member) => member.user.id));
  }

  private async toEntryDto(
    spaceId: Space['id'],
    row: SpaceAuditLog,
    display: (userId: number) => string,
  ): Promise<SpaceAuditLogEntryDto> {
    const targetUserId = getTargetUserId(row.payload);
    const payload = await this.spaceEncryptionService.decryptAuditPayload(
      spaceId,
      row.eventType,
      allowlistPayload(row),
    );
    return {
      id: row.id,
      eventType: row.eventType,
      actorUserId: row.actorUserId,
      actor: display(row.actorUserId),
      targetUser: targetUserId === null ? null : display(targetUserId),
      payload,
      createdAt: row.createdAt,
    };
  }
}

function getTargetUserId(payload: SpaceAuditLog['payload']): number | null {
  return 'targetUserId' in payload && typeof payload.targetUserId === 'number'
    ? payload.targetUserId
    : null;
}

// Payloads are re-parsed against the taxonomy at read time; rows that no
// longer parse degrade to an empty payload.
function allowlistPayload(row: SpaceAuditLog): Record<string, unknown> {
  const result = SpaceAuditEventSchema.safeParse({
    eventType: row.eventType,
    payload: row.payload,
  });
  return result.success ? result.data.payload : {};
}

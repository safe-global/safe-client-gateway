// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { spaceAuditLogBuilder } from '@/modules/spaces/datasources/audit/entities/__tests__/space-audit-log.entity.db.builder';
import { createMockSpaceEncryptionService } from '@/modules/spaces/domain/__tests__/space-encryption.service.mock';
import { createMockSpaceAuditRepository } from '@/modules/spaces/domain/audit/__tests__/space-audit.repository.mock';
import {
  FORMER_MEMBER_LABEL,
  SpaceAuditService,
} from '@/modules/spaces/routes/audit/space-audit.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import type { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver/user-identity-resolver.service';
import { PaginationData } from '@/routes/common/pagination/pagination.data';

const spaceAuditRepository = createMockSpaceAuditRepository();

const membersRepository = {
  findOne: vi.fn(),
  find: vi.fn(),
} as MockedObject<IMembersRepository>;

const identityResolver = {
  resolveMany: vi.fn(),
} as MockedObject<UserIdentityResolverService>;

describe('SpaceAuditService', () => {
  let service: SpaceAuditService;
  let spaceEncryptionService: ReturnType<
    typeof createMockSpaceEncryptionService
  >;

  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const viewerUserId = faker.number.int({ min: 1, max: 100_000 });
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', viewerUserId.toString()).build(),
  );
  const routeUrl = new URL(`https://safe.test/v1/spaces/${spaceId}/audit-log`);

  function mockViewer(role: 'ADMIN' | 'MEMBER' = 'MEMBER'): void {
    membersRepository.findOne.mockResolvedValue(
      memberBuilder()
        .with('role', role)
        .with('status', 'ACTIVE')
        .with('user', { id: viewerUserId } as User)
        .build(),
    );
  }

  function mockActiveMemberIds(userIds: Array<number>): void {
    membersRepository.find.mockResolvedValue(
      userIds.map((id) =>
        memberBuilder()
          .with('status', 'ACTIVE')
          .with('user', { id } as User)
          .build(),
      ),
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    spaceEncryptionService = createMockSpaceEncryptionService();
    service = new SpaceAuditService(
      spaceAuditRepository,
      membersRepository,
      identityResolver,
      spaceEncryptionService,
    );
    identityResolver.resolveMany.mockResolvedValue(new Map());
    membersRepository.find.mockResolvedValue([]);
    spaceAuditRepository.findBySpaceId.mockResolvedValue([[], 0]);
    spaceAuditRepository.findDistinctActorIds.mockResolvedValue([]);
  });

  describe('getAuditLog', () => {
    it('should throw a ForbiddenException when the viewer has no ACTIVE membership', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        }),
      ).rejects.toThrow(
        new ForbiddenException('User is not a member of this workspace'),
      );

      expect(membersRepository.findOne).toHaveBeenCalledWith({
        user: { id: viewerUserId },
        space: { id: spaceId },
        status: 'ACTIVE',
      });
      expect(spaceAuditRepository.findBySpaceId).not.toHaveBeenCalled();
    });

    it('decrypts each row payload via decryptAuditPayload before returning it', async () => {
      mockViewer();
      const encryptedAddress = `kms:v1:${faker.string.alphanumeric(16)}`;
      const encryptedName = `kms:v1:${faker.string.alphanumeric(16)}`;
      const decryptedAddress = faker.finance.ethereumAddress();
      const decryptedName = faker.person.fullName();
      const row = spaceAuditLogBuilder()
        .with('spaceId', spaceId)
        .with('eventType', 'ADDRESS_BOOK_DELETED')
        .with('actorUserId', viewerUserId)
        .with('payload', { address: encryptedAddress, name: encryptedName })
        .build();
      spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);
      spaceEncryptionService.decryptAuditPayload.mockResolvedValue({
        address: decryptedAddress,
        name: decryptedName,
      });

      const result = await service.getAuditLog({
        authPayload,
        spaceId,
        routeUrl,
        paginationData: new PaginationData(20, 0),
        filters: {},
      });

      expect(
        spaceEncryptionService.decryptAuditPayload,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, 'ADDRESS_BOOK_DELETED', {
        address: encryptedAddress,
        name: encryptedName,
      });
      expect(result.results[0].payload).toStrictEqual({
        address: decryptedAddress,
        name: decryptedName,
      });
    });

    it('should resolve actor and target display strings with one resolveMany call', async () => {
      mockViewer();
      const actorUserId = faker.number.int({ min: 1, max: 100_000 });
      const targetUserId = faker.number.int({
        min: 100_001,
        max: 200_000,
      });
      const actorAddress = faker.finance.ethereumAddress();
      const targetAddress = faker.finance.ethereumAddress();
      const row = spaceAuditLogBuilder()
        .with('spaceId', spaceId)
        .with('eventType', 'MEMBER_ROLE_UPDATED')
        .with('actorUserId', actorUserId)
        .with('payload', {
          targetUserId,
          oldRole: 'MEMBER',
          newRole: 'ADMIN',
        })
        .build();
      spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);
      identityResolver.resolveMany.mockResolvedValue(
        new Map([
          [actorUserId, actorAddress],
          [targetUserId, targetAddress],
        ]),
      );

      const page = await service.getAuditLog({
        authPayload,
        spaceId,
        routeUrl,
        paginationData: new PaginationData(20, 0),
        filters: {},
      });

      expect(identityResolver.resolveMany).toHaveBeenCalledTimes(1);
      expect(identityResolver.resolveMany).toHaveBeenCalledWith([
        actorUserId,
        targetUserId,
      ]);
      expect(page.results).toStrictEqual([
        {
          id: row.id,
          eventType: 'MEMBER_ROLE_UPDATED',
          actorUserId,
          actor: actorAddress,
          targetUser: targetAddress,
          payload: { targetUserId, oldRole: 'MEMBER', newRole: 'ADMIN' },
          createdAt: row.createdAt,
        },
      ]);
    });

    it('should fall back to the deleted-user label for unresolvable users and null target when the event has none', async () => {
      mockViewer();
      const row = spaceAuditLogBuilder()
        .with('spaceId', spaceId)
        .with('eventType', 'SPACE_CREATED')
        .with('payload', { name: faker.lorem.words() })
        .build();
      spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);
      identityResolver.resolveMany.mockResolvedValue(new Map());

      const page = await service.getAuditLog({
        authPayload,
        spaceId,
        routeUrl,
        paginationData: new PaginationData(20, 0),
        filters: {},
      });

      expect(page.results[0].actor).toBe('Deleted user');
      expect(page.results[0].targetUser).toBeNull();
    });

    describe('email masking', () => {
      const subjectUserId = faker.number.int({ min: 1, max: 100_000 });
      const subjectEmail = faker.internet.email();

      function mockEmailSubjectRow(): void {
        const row = spaceAuditLogBuilder()
          .with('spaceId', spaceId)
          .with('eventType', 'MEMBER_INVITE_ACCEPTED')
          .with('actorUserId', subjectUserId)
          .with('payload', { targetUserId: subjectUserId })
          .build();
        spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);
        identityResolver.resolveMany.mockResolvedValue(
          new Map([[subjectUserId, subjectEmail]]),
        );
      }

      it('should mask an email subject as a former member for a non-admin viewer when the subject is not an ACTIVE member', async () => {
        mockViewer('MEMBER');
        mockEmailSubjectRow();
        mockActiveMemberIds([viewerUserId]);

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        });

        expect(page.results[0].actor).toBe(FORMER_MEMBER_LABEL);
        expect(page.results[0].targetUser).toBe(FORMER_MEMBER_LABEL);
        expect(JSON.stringify(page)).not.toContain(subjectEmail);
      });

      it('should expose the email when the subject is an ACTIVE member', async () => {
        mockViewer('MEMBER');
        mockEmailSubjectRow();
        mockActiveMemberIds([viewerUserId, subjectUserId]);

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        });

        expect(page.results[0].actor).toBe(subjectEmail);
      });

      it('should expose the email to an active admin viewer even when the subject is not an ACTIVE member', async () => {
        mockViewer('ADMIN');
        mockEmailSubjectRow();
        mockActiveMemberIds([viewerUserId]);

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        });

        expect(page.results[0].actor).toBe(subjectEmail);
      });

      it('should never mask wallet-address display strings', async () => {
        mockViewer('MEMBER');
        const address = faker.finance.ethereumAddress();
        const row = spaceAuditLogBuilder()
          .with('spaceId', spaceId)
          .with('eventType', 'MEMBER_LEFT')
          .with('actorUserId', subjectUserId)
          .with('payload', { targetUserId: subjectUserId })
          .build();
        spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);
        identityResolver.resolveMany.mockResolvedValue(
          new Map([[subjectUserId, address]]),
        );
        mockActiveMemberIds([viewerUserId]);

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        });

        expect(page.results[0].actor).toBe(address);
      });
    });

    describe('payload allowlist', () => {
      it('should strip fields that are not part of the event taxonomy', async () => {
        mockViewer();
        const targetUserId = faker.number.int({ min: 1, max: 100_000 });
        const row = spaceAuditLogBuilder()
          .with('spaceId', spaceId)
          .with('eventType', 'MEMBER_INVITE_ACCEPTED')
          .with('payload', {
            targetUserId,
            email: faker.internet.email(),
          } as never)
          .build();
        spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        });

        expect(page.results[0].payload).toStrictEqual({ targetUserId });
      });

      it('should degrade an unparsable payload to an empty object', async () => {
        mockViewer();
        const row = spaceAuditLogBuilder()
          .with('spaceId', spaceId)
          .with('eventType', 'SPACE_CREATED')
          // name missing — does not parse against the SPACE_CREATED schema
          .with('payload', {} as never)
          .build();
        spaceAuditRepository.findBySpaceId.mockResolvedValue([[row], 1]);

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, 0),
          filters: {},
        });

        expect(page.results[0].payload).toStrictEqual({});
      });
    });

    describe('pagination', () => {
      it('should clamp the limit to 100', async () => {
        mockViewer();

        await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(500, 0),
          filters: {},
        });

        expect(spaceAuditRepository.findBySpaceId).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 100 }),
        );
      });

      it('should build page links from the clamped values, not the raw cursor', async () => {
        mockViewer();
        spaceAuditRepository.findBySpaceId.mockResolvedValue([
          [spaceAuditLogBuilder().with('spaceId', spaceId).build()],
          150,
        ]);
        const oversizedCursorUrl = new URL(
          `https://safe.test/v1/spaces/${spaceId}/audit-log?cursor=limit%3D500%26offset%3D0`,
        );

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl: oversizedCursorUrl,
          paginationData: PaginationData.fromCursor(oversizedCursorUrl),
          filters: {},
        });

        // 100 of 150 rows were sent — there must be a next page at offset 100.
        expect(page.next).toContain('cursor=limit%3D100%26offset%3D100');
        expect(page.previous).toBeNull();
      });

      it('should floor a negative offset at 0', async () => {
        mockViewer();

        await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl,
          paginationData: new PaginationData(20, -5),
          filters: {},
        });

        expect(spaceAuditRepository.findBySpaceId).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 0 }),
        );
      });

      it('should fall back to default pagination for a malformed cursor', async () => {
        mockViewer();
        const malformedCursorUrl = new URL(
          `https://safe.test/v1/spaces/${spaceId}/audit-log?cursor=not-a-cursor`,
        );

        await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl: malformedCursorUrl,
          paginationData: PaginationData.fromCursor(malformedCursorUrl),
          filters: {},
        });

        expect(spaceAuditRepository.findBySpaceId).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          }),
        );
      });

      it('should build next/previous page urls from the route url', async () => {
        mockViewer();
        const rows = [spaceAuditLogBuilder().with('spaceId', spaceId).build()];
        spaceAuditRepository.findBySpaceId.mockResolvedValue([rows, 50]);
        const cursorUrl = new URL(
          `https://safe.test/v1/spaces/${spaceId}/audit-log?cursor=limit%3D20%26offset%3D20`,
        );

        const page = await service.getAuditLog({
          authPayload,
          spaceId,
          routeUrl: cursorUrl,
          paginationData: PaginationData.fromCursor(cursorUrl),
          filters: {},
        });

        expect(page.count).toBe(50);
        expect(page.next).toContain('cursor=limit%3D20%26offset%3D40');
        expect(page.previous).toContain('cursor=limit%3D20%26offset%3D0');
      });
    });

    it('should pass filters through to the repository', async () => {
      mockViewer();
      const filters = {
        eventTypes: ['SPACE_CREATED' as const, 'MEMBER_INVITED' as const],
        actorUserId: faker.number.int({ min: 1, max: 100_000 }),
        createdAtGte: faker.date.past(),
        createdAtLte: faker.date.recent(),
        sortDirection: 'asc' as const,
      };

      await service.getAuditLog({
        authPayload,
        spaceId,
        routeUrl,
        paginationData: new PaginationData(20, 0),
        filters,
      });

      expect(spaceAuditRepository.findBySpaceId).toHaveBeenCalledWith({
        spaceId,
        limit: 20,
        offset: 0,
        ...filters,
      });
    });
  });

  describe('getAuditLogActors', () => {
    it('should throw a ForbiddenException when the viewer has no ACTIVE membership', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAuditLogActors({ authPayload, spaceId }),
      ).rejects.toThrow(ForbiddenException);

      expect(spaceAuditRepository.findDistinctActorIds).not.toHaveBeenCalled();
    });

    it('should return resolved actors including non-members, applying the masking rule', async () => {
      mockViewer('MEMBER');
      const memberActorId = faker.number.int({ min: 1, max: 100_000 });
      const formerActorId = faker.number.int({ min: 100_001, max: 200_000 });
      const memberAddress = faker.finance.ethereumAddress();
      spaceAuditRepository.findDistinctActorIds.mockResolvedValue([
        memberActorId,
        formerActorId,
      ]);
      identityResolver.resolveMany.mockResolvedValue(
        new Map([
          [memberActorId, memberAddress],
          [formerActorId, faker.internet.email()],
        ]),
      );
      mockActiveMemberIds([viewerUserId, memberActorId]);

      const actors = await service.getAuditLogActors({ authPayload, spaceId });

      expect(actors).toStrictEqual([
        { actorUserId: memberActorId, actor: memberAddress },
        { actorUserId: formerActorId, actor: FORMER_MEMBER_LABEL },
      ]);
    });
  });
});

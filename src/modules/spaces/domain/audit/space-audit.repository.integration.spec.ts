// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceAuditLog } from '@/modules/spaces/datasources/entities/space-audit-log.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { SpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import {
  InviteType,
  type InviteUserInput,
} from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { MembersRepository } from '@/modules/users/domain/members/members.repository';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('SpaceAuditRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let spaceAuditRepository: SpaceAuditRepository;
  let spacesRepository: SpacesRepository;
  let membersRepository: MembersRepository;
  let usersRepository: UsersRepository;

  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
  const testConfiguration = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [Member, Space, SpaceAuditLog, SpaceSafe, User, Wallet],
  });

  const dbUserRepo = dataSource.getRepository(User);
  const dbWalletRepo = dataSource.getRepository(Wallet);
  const dbMembersRepo = dataSource.getRepository(Member);
  const dbAuditRepo = dataSource.getRepository(SpaceAuditLog);

  beforeAll(async () => {
    // Create database
    const testDataSource = new DataSource({
      ...postgresConfig({
        ...testConfiguration.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });
    const testPostgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      testDataSource,
    );
    await testPostgresDatabaseService.initializeDatabaseConnection();
    await testPostgresDatabaseService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await testPostgresDatabaseService.destroyDatabaseConnection();

    // Create database connection
    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      dataSource,
    );
    await postgresDatabaseService.initializeDatabaseConnection();

    // Migrate database
    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
      }),
    } as jest.MockedObjectDeep<ConfigService>;
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    );
    await migrator.migrate();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'features.spaceAuditLog') {
        return true;
      }
      if (key === 'spaces.maxSpaceCreationsPerUser') {
        return testConfiguration.spaces.maxSpaceCreationsPerUser;
      }
    });

    spaceAuditRepository = new SpaceAuditRepository(
      postgresDatabaseService,
      mockConfigurationService,
    );
    spacesRepository = new SpacesRepository(
      postgresDatabaseService,
      mockConfigurationService,
      spaceAuditRepository,
    );
    const walletsRepository = new WalletsRepository(postgresDatabaseService);
    usersRepository = new UsersRepository(
      postgresDatabaseService,
      walletsRepository,
      spaceAuditRepository,
    );
    membersRepository = new MembersRepository(
      postgresDatabaseService,
      usersRepository,
      spacesRepository,
      spaceAuditRepository,
    );
  });

  afterEach(async () => {
    // Audit rows are deliberately NOT deleted (the triggers forbid it):
    // every test works on a fresh space and scopes its reads by spaceId.
    await dbMembersRepo.createQueryBuilder().delete().where('1=1').execute();
    await dataSource
      .getRepository(Space)
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dbWalletRepo.createQueryBuilder().delete().where('1=1').execute();
    await dbUserRepo.createQueryBuilder().delete().where('1=1').execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  async function createSiweUser(): Promise<{
    userId: number;
    authPayload: AuthPayload;
  }> {
    const user = await dbUserRepo.insert({ status: 'ACTIVE' });
    const userId = user.generatedMaps[0].id as number;
    const authPayloadDto = siweAuthPayloadDtoBuilder()
      .with('sub', userId.toString())
      .build();
    await dbWalletRepo.insert({
      user: user.generatedMaps[0],
      address: authPayloadDto.signer_address,
    });
    return { userId, authPayload: new AuthPayload(authPayloadDto) };
  }

  async function createSpaceWithAdmin(): Promise<{
    spaceId: number;
    spaceUuid: Space['uuid'];
    adminUserId: number;
    adminAuthPayload: AuthPayload;
  }> {
    const { userId, authPayload } = await createSiweUser();
    const space = await spacesRepository.create({
      userId,
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    const spaceId = await spacesRepository.findIdByUuid(space.uuid);
    return {
      spaceId,
      spaceUuid: space.uuid,
      adminUserId: userId,
      adminAuthPayload: authPayload,
    };
  }

  async function inviteUser(args: {
    spaceId: number;
    adminAuthPayload: AuthPayload;
    role?: 'ADMIN' | 'MEMBER';
  }): Promise<{ userId: number; authPayload: AuthPayload }> {
    const invitee = await createSiweUser();
    const wallet = await dbWalletRepo.findOneOrFail({
      where: { user: { id: invitee.userId } },
    });
    await membersRepository.inviteUsers({
      authPayload: args.adminAuthPayload,
      spaceId: args.spaceId,
      users: [
        {
          type: InviteType.Wallet,
          address: wallet.address,
          role: args.role ?? 'MEMBER',
          name: nameBuilder(),
        },
      ],
      inviteExpiresAt: faker.date.future(),
    });
    return invitee;
  }

  describe('record (through instrumented mutations)', () => {
    it('should record SPACE_CREATED on space creation', async () => {
      const { spaceId, spaceUuid, adminUserId } = await createSpaceWithAdmin();

      const rows = await dbAuditRepo.findBy({ spaceId });

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        spaceId,
        spaceUuid,
        eventType: 'SPACE_CREATED',
        actorUserId: adminUserId,
      });
      expect(rows[0].payload).toHaveProperty('name');
    });

    it('should record MEMBER_ROLE_UPDATED with old and new role', async () => {
      const { spaceId, adminUserId, adminAuthPayload } =
        await createSpaceWithAdmin();
      const invitee = await inviteUser({ spaceId, adminAuthPayload });

      await membersRepository.updateRole({
        authPayload: adminAuthPayload,
        spaceId,
        userId: invitee.userId,
        role: 'ADMIN',
      });

      const rows = await dbAuditRepo.findBy({
        spaceId,
        eventType: 'MEMBER_ROLE_UPDATED',
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].actorUserId).toBe(adminUserId);
      expect(rows[0].payload).toStrictEqual({
        targetUserId: invitee.userId,
        oldRole: 'MEMBER',
        newRole: 'ADMIN',
      });
    });

    it('should roll the business mutation back when the transaction fails after recording', async () => {
      const { spaceId, spaceUuid, adminUserId } = await createSpaceWithAdmin();
      const membersBefore = await dbMembersRepo.countBy({
        space: { id: spaceId },
      });

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          await spaceAuditRepository.record(entityManager, {
            spaceId,
            spaceUuid,
            eventType: SpaceAuditEventType.MEMBER_ALIAS_UPDATED,
            actorUserId: adminUserId,
            payload: { targetUserId: adminUserId },
          });
          await entityManager.update(
            Member,
            { space: { id: spaceId } },
            { alias: 'rolled-back' },
          );
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      const auditRows = await dbAuditRepo.findBy({
        spaceId,
        eventType: 'MEMBER_ALIAS_UPDATED',
      });
      expect(auditRows).toHaveLength(0);
      await expect(
        dbMembersRepo.countBy({ space: { id: spaceId }, alias: 'rolled-back' }),
      ).resolves.toBe(0);
      await expect(
        dbMembersRepo.countBy({ space: { id: spaceId } }),
      ).resolves.toBe(membersBefore);
    });

    it('should record one MEMBER_INVITED row per invitee in a single transaction', async () => {
      const { spaceId, adminUserId, adminAuthPayload } =
        await createSpaceWithAdmin();

      await membersRepository.inviteUsers({
        authPayload: adminAuthPayload,
        spaceId,
        users: Array.from(
          { length: 3 },
          (): InviteUserInput => ({
            type: InviteType.Email,
            email: fakeEmailAddress(),
            role: 'MEMBER',
            name: nameBuilder(),
          }),
        ),
        inviteExpiresAt: faker.date.future(),
      });

      const rows = await dbAuditRepo.findBy({
        spaceId,
        eventType: 'MEMBER_INVITED',
      });
      expect(rows).toHaveLength(3);
      // All rows of one transaction share created_at (CURRENT_TIMESTAMP is
      // transaction start time).
      const timestamps = new Set(
        rows.map((row) => row.createdAt.toISOString()),
      );
      expect(timestamps.size).toBe(1);
      for (const row of rows) {
        expect(row.actorUserId).toBe(adminUserId);
        expect(row.payload).toMatchObject({ role: 'MEMBER' });
      }
    });

    it('should record MEMBER_LEFT with accountDeleted only for ACTIVE memberships on user deletion', async () => {
      const spaceA = await createSpaceWithAdmin();
      const spaceB = await createSpaceWithAdmin();
      const invitee = await createSiweUser();
      const wallet = await dbWalletRepo.findOneOrFail({
        where: { user: { id: invitee.userId } },
      });
      for (const space of [spaceA, spaceB]) {
        await membersRepository.inviteUsers({
          authPayload: space.adminAuthPayload,
          spaceId: space.spaceId,
          users: [
            {
              type: InviteType.Wallet,
              address: wallet.address,
              role: 'MEMBER',
              name: nameBuilder(),
            },
          ],
          inviteExpiresAt: faker.date.future(),
        });
      }
      // The invitee joins space A but never accepts the space B invite.
      await membersRepository.acceptInvite({
        authPayload: invitee.authPayload,
        spaceId: spaceA.spaceId,
        payload: { name: nameBuilder() },
      });

      await usersRepository.delete(invitee.authPayload);

      const rowsA = await dbAuditRepo.findBy({
        spaceId: spaceA.spaceId,
        eventType: 'MEMBER_LEFT',
      });
      expect(rowsA).toHaveLength(1);
      expect(rowsA[0].actorUserId).toBe(invitee.userId);
      expect(rowsA[0].payload).toStrictEqual({
        targetUserId: invitee.userId,
        accountDeleted: true,
      });
      // A pending invite is not a departure.
      await expect(
        dbAuditRepo.countBy({
          spaceId: spaceB.spaceId,
          eventType: 'MEMBER_LEFT',
        }),
      ).resolves.toBe(0);
      // The user and the cascading member rows are gone, the audit rows stay.
      await expect(
        dbUserRepo.findOneBy({ id: invitee.userId }),
      ).resolves.toBeNull();
      await expect(
        dbMembersRepo.countBy({ user: { id: invitee.userId } }),
      ).resolves.toBe(0);
    });
  });

  describe('append-only enforcement', () => {
    it('should reject raw UPDATE and DELETE and force created_at on INSERT', async () => {
      const { spaceId, spaceUuid, adminUserId } = await createSpaceWithAdmin();
      const [row] = await dbAuditRepo.findBy({ spaceId });

      await expect(
        dataSource.query(
          `UPDATE space_audit_log SET event_type = 'SPACE_DELETED' WHERE id = $1`,
          [row.id],
        ),
      ).rejects.toThrow('space_audit_log is append-only');

      await expect(
        dataSource.query(`DELETE FROM space_audit_log WHERE id = $1`, [row.id]),
      ).rejects.toThrow('space_audit_log is append-only');

      // A supplied (backdated) created_at is overwritten server-side.
      const backdated = '2000-01-01T00:00:00Z';
      const inserted: Array<{ created_at: Date }> = await dataSource.query(
        `INSERT INTO space_audit_log (space_id, space_uuid, event_type, actor_user_id, payload, created_at)
         VALUES ($1, $2, 'SPACE_CREATED', $3, '{"name":"x"}', $4)
         RETURNING created_at`,
        [spaceId, spaceUuid, adminUserId, backdated],
      );
      expect(inserted[0].created_at.getTime()).toBeGreaterThan(
        new Date(backdated).getTime(),
      );
      expect(
        Math.abs(inserted[0].created_at.getTime() - Date.now()),
      ).toBeLessThan(60_000);
    });
  });

  describe('findBySpaceId', () => {
    it('should order newest-first by default, scope by space and reverse with asc', async () => {
      const { spaceId, adminAuthPayload } = await createSpaceWithAdmin();
      const other = await createSpaceWithAdmin();
      const invitee = await inviteUser({ spaceId, adminAuthPayload });
      await membersRepository.updateRole({
        authPayload: adminAuthPayload,
        spaceId,
        userId: invitee.userId,
        role: 'ADMIN',
      });

      const [desc, count] = await spaceAuditRepository.findBySpaceId({
        spaceId,
        limit: 10,
        offset: 0,
      });

      expect(count).toBe(3);
      expect(desc.map((row) => row.eventType)).toStrictEqual([
        'MEMBER_ROLE_UPDATED',
        'MEMBER_INVITED',
        'SPACE_CREATED',
      ]);
      // Scoped: the other space's rows are not interleaved.
      expect(desc.every((row) => row.spaceId === spaceId)).toBe(true);
      expect(desc.every((row) => row.spaceId !== other.spaceId)).toBe(true);

      const [asc] = await spaceAuditRepository.findBySpaceId({
        spaceId,
        limit: 10,
        offset: 0,
        sortDirection: 'asc',
      });
      expect(asc.map((row) => row.eventType)).toStrictEqual([
        'SPACE_CREATED',
        'MEMBER_INVITED',
        'MEMBER_ROLE_UPDATED',
      ]);
    });

    it('should paginate same-timestamp rows without skips or duplicates (id tie-break)', async () => {
      const { spaceId, adminAuthPayload } = await createSpaceWithAdmin();
      // 5 MEMBER_INVITED rows in ONE transaction → identical created_at.
      await membersRepository.inviteUsers({
        authPayload: adminAuthPayload,
        spaceId,
        users: Array.from(
          { length: 5 },
          (): InviteUserInput => ({
            type: InviteType.Email,
            email: fakeEmailAddress(),
            role: 'MEMBER',
            name: nameBuilder(),
          }),
        ),
        inviteExpiresAt: faker.date.future(),
      });

      const [all, count] = await spaceAuditRepository.findBySpaceId({
        spaceId,
        limit: 100,
        offset: 0,
      });
      expect(count).toBe(6); // SPACE_CREATED + 5 invites

      const paginated: Array<string> = [];
      for (let offset = 0; offset < count; offset += 2) {
        const [page] = await spaceAuditRepository.findBySpaceId({
          spaceId,
          limit: 2,
          offset,
        });
        paginated.push(...page.map((row) => row.id));
      }

      expect(paginated).toStrictEqual(all.map((row) => row.id));
      expect(new Set(paginated).size).toBe(count);
    });

    it('should filter by eventTypes, actorUserId and created-at range (AND-combined) and count the filtered set', async () => {
      const { spaceId, adminUserId, adminAuthPayload } =
        await createSpaceWithAdmin();
      const invitee = await inviteUser({ spaceId, adminAuthPayload });
      await membersRepository.updateRole({
        authPayload: adminAuthPayload,
        spaceId,
        userId: invitee.userId,
        role: 'ADMIN',
      });

      const [byType, byTypeCount] = await spaceAuditRepository.findBySpaceId({
        spaceId,
        limit: 10,
        offset: 0,
        eventTypes: ['SPACE_CREATED', 'MEMBER_INVITED'],
      });
      expect(byTypeCount).toBe(2);
      expect(byType.map((row) => row.eventType).sort()).toStrictEqual([
        'MEMBER_INVITED',
        'SPACE_CREATED',
      ]);

      const [, byActorCount] = await spaceAuditRepository.findBySpaceId({
        spaceId,
        limit: 10,
        offset: 0,
        actorUserId: adminUserId,
      });
      expect(byActorCount).toBe(3);

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourAhead = new Date(Date.now() + 60 * 60 * 1000);
      const [, inRangeCount] = await spaceAuditRepository.findBySpaceId({
        spaceId,
        limit: 10,
        offset: 0,
        createdAtGte: hourAgo,
        createdAtLte: hourAhead,
      });
      expect(inRangeCount).toBe(3);

      const [outOfRange, outOfRangeCount] =
        await spaceAuditRepository.findBySpaceId({
          spaceId,
          limit: 10,
          offset: 0,
          createdAtLte: hourAgo,
        });
      expect(outOfRangeCount).toBe(0);
      expect(outOfRange).toStrictEqual([]);

      // AND-combined: matching type + actor + range.
      const [combined, combinedCount] =
        await spaceAuditRepository.findBySpaceId({
          spaceId,
          limit: 10,
          offset: 0,
          eventTypes: ['MEMBER_ROLE_UPDATED'],
          actorUserId: adminUserId,
          createdAtGte: hourAgo,
          createdAtLte: hourAhead,
        });
      expect(combinedCount).toBe(1);
      expect(combined[0].eventType).toBe('MEMBER_ROLE_UPDATED');
    });
  });

  describe('findDistinctActorIds', () => {
    it('should return every actor once, including removed members whose events stay filterable', async () => {
      const { spaceId, adminUserId, adminAuthPayload } =
        await createSpaceWithAdmin();
      const invitee = await inviteUser({ spaceId, adminAuthPayload });
      await membersRepository.acceptInvite({
        authPayload: invitee.authPayload,
        spaceId,
        payload: { name: nameBuilder() },
      });
      await membersRepository.removeUser({
        authPayload: adminAuthPayload,
        spaceId,
        userId: invitee.userId,
      });

      const actorIds = await spaceAuditRepository.findDistinctActorIds(spaceId);

      expect(actorIds).toStrictEqual(
        [adminUserId, invitee.userId].sort((a, b) => a - b),
      );
      // The ex-member is gone from the space but their events stay filterable.
      await expect(
        dbMembersRepo.countBy({ user: { id: invitee.userId } }),
      ).resolves.toBe(0);
      const [exMemberEvents, exMemberCount] =
        await spaceAuditRepository.findBySpaceId({
          spaceId,
          limit: 10,
          offset: 0,
          actorUserId: invitee.userId,
        });
      expect(exMemberCount).toBe(1);
      expect(exMemberEvents[0].eventType).toBe('MEMBER_INVITE_ACCEPTED');
    });
  });

  describe('record (flag off)', () => {
    it('should be a no-op when the feature flag is disabled', async () => {
      const { spaceId, spaceUuid, adminUserId } = await createSpaceWithAdmin();
      const disabledConfigurationService = jest.mocked({
        getOrThrow: jest.fn().mockImplementation((key: string) => {
          if (key === 'features.spaceAuditLog') {
            return false;
          }
        }),
      } as jest.MockedObjectDeep<IConfigurationService>);
      const disabledRepository = new SpaceAuditRepository(
        postgresDatabaseService,
        disabledConfigurationService,
      );

      await postgresDatabaseService.transaction(async (entityManager) => {
        await disabledRepository.record(entityManager, {
          spaceId,
          spaceUuid,
          eventType: SpaceAuditEventType.MEMBER_ALIAS_UPDATED,
          actorUserId: adminUserId,
          payload: { targetUserId: adminUserId },
        });
      });

      await expect(
        dbAuditRepo.countBy({ spaceId, eventType: 'MEMBER_ALIAS_UPDATED' }),
      ).resolves.toBe(0);
    });
  });
});

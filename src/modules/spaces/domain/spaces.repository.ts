// SPDX-License-Identifier: FSL-1.1-MIT

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type FindOptionsRelations,
  type FindOptionsSelect,
  type FindOptionsWhere,
  In,
  IsNull,
} from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { FieldEncryptionAad } from '@/datasources/encryption/field-encryption.constants';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';
import { getEnumKey } from '@/domain/common/utils/enum';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import {
  SpaceAuditEventType,
  type SpaceUpdatedPayload,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';

@Injectable()
export class SpacesRepository implements ISpacesRepository {
  private readonly maxSpaceCreationsPerUser: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    private readonly fieldCrypto: PerEntityFieldCrypto,
  ) {
    this.maxSpaceCreationsPerUser =
      this.configurationService.getOrThrow<number>(
        'spaces.maxSpaceCreationsPerUser',
      );
  }

  public async create(args: {
    userId: number;
    name: string;
    status: keyof typeof SpaceStatus;
  }): Promise<Pick<Space, 'uuid' | 'name'>> {
    const isLimited = await this.isLimited(args.userId);
    if (isLimited) {
      throw new ForbiddenException(
        'User has reached the maximum number of Workspaces.',
      );
    }

    const user = new User();
    user.id = args.userId;

    const space = new Space();
    space.status = args.status;
    space.name = args.name;

    // @todo Move to MembersRepository
    const member = new Member();
    member.name = `${space.name} creator`;
    member.role = getEnumKey(MemberRole, MemberRole.ADMIN);
    member.status = getEnumKey(MemberStatus, MemberStatus.ACTIVE);
    member.user = user;
    member.space = space;

    space.members = [member];

    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        // Insert first to obtain the space id, then mint a DEK bound to it and
        // overwrite the name columns with ciphertext — all within this
        // transaction, so plaintext is never committed. The KMS encryption
        // context binds the key to this space id.
        const saved = await entityManager.save(space);
        const plaintextName = saved.name;

        const { encryptedDataKey, values } =
          await this.fieldCrypto.encryptFields(
            { spaceId: String(saved.id) },
            undefined,
            [
              { value: saved.name, aad: FieldEncryptionAad.SPACE_NAME },
              {
                value: saved.members[0].name,
                aad: FieldEncryptionAad.MEMBER_NAME,
              },
            ],
          );
        // null only when encryption is disabled, in which case the plaintext
        // already persisted by save() is correct and no rewrite is needed.
        if (encryptedDataKey !== null) {
          await entityManager.update(Space, saved.id, {
            name: values[0],
            encryptedDataKey,
          });
          await entityManager.update(Member, saved.members[0].id, {
            name: values[1],
          });
        }

        await this.spaceAuditRepository.record(entityManager, {
          spaceId: saved.id,
          spaceUuid: saved.uuid,
          eventType: SpaceAuditEventType.SPACE_CREATED,
          actorUserId: args.userId,
          payload: { name: plaintextName },
        });

        return {
          uuid: saved.uuid,
          name: plaintextName,
        };
      },
    );
  }

  /**
   * Decrypts a loaded space's `name` and any loaded members' `name`/`alias`
   * under the space's per-space key — one KMS unwrap per space. Safe to call when
   * encryption is disabled or the row is legacy plaintext (passthrough).
   */
  private async decryptSpace(space: Space): Promise<void> {
    const assigners: Array<(value: string) => void> = [];
    const fields: Array<{ value: string; aad: string }> = [];

    if (typeof space.name === 'string') {
      fields.push({ value: space.name, aad: FieldEncryptionAad.SPACE_NAME });
      assigners.push((value) => {
        space.name = value;
      });
    }
    if (Array.isArray(space.members)) {
      for (const member of space.members) {
        if (typeof member.name === 'string') {
          fields.push({
            value: member.name,
            aad: FieldEncryptionAad.MEMBER_NAME,
          });
          assigners.push((value) => {
            member.name = value;
          });
        }
        if (typeof member.alias === 'string') {
          fields.push({
            value: member.alias,
            aad: FieldEncryptionAad.MEMBER_ALIAS,
          });
          assigners.push((value) => {
            member.alias = value;
          });
        }
      }
    }
    if (fields.length === 0) {
      return;
    }

    const decrypted = await this.fieldCrypto.decryptFields(
      { spaceId: String(space.id) },
      space.encryptedDataKey,
      fields,
    );
    decrypted.forEach((value, index) => {
      assigners[index](value);
    });
  }

  /**
   * When a caller selects `name` explicitly, also load `id` and
   * `encrypted_data_key` so the row can be decrypted after load.
   */
  private withDecryptableSelect<
    T extends { select?: FindOptionsSelect<Space> },
  >(args: T): T {
    if (args.select?.name) {
      return {
        ...args,
        select: { ...args.select, id: true, encryptedDataKey: true },
      };
    }
    return args;
  }

  public async findOneOrFail(
    args: Parameters<SpacesRepository['findOne']>[0],
  ): Promise<Space> {
    const space = await this.findOne(args);

    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }

    return space;
  }

  public async findOne(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const space = await spaceRepository.findOne(
      this.withDecryptableSelect(args),
    );
    if (space) {
      await this.decryptSpace(space);
    }
    return space;
  }

  public async findOrFail(
    args: Parameters<SpacesRepository['find']>[0],
  ): Promise<Array<Space>> {
    const spaces = await this.find(args);

    if (spaces.length === 0) {
      throw new NotFoundException('Workspaces not found.');
    }

    return spaces;
  }

  public async find(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const spaces = await spaceRepository.find(this.withDecryptableSelect(args));
    for (const space of spaces) {
      await this.decryptSpace(space);
    }
    return spaces;
  }

  public async findByUserIdOrFail(
    args: Parameters<SpacesRepository['findByUserId']>[0],
  ): Promise<Array<Space>> {
    const spaces = await this.findByUserId(args);

    if (spaces.length === 0) {
      throw new NotFoundException(
        `Workspaces not found. UserId = ${args.userId}`,
      );
    }

    return spaces;
  }

  public async findByUserId(args: {
    userId: number;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const memberRepository =
      await this.postgresDatabaseService.getRepository(Member);

    const members = await memberRepository.find({
      where: { user: { id: args.userId } },
      relations: ['space'],
    });
    const membersIds = members.map((member) => member.space.id);

    const spaces = await spaceRepository.find(
      this.withDecryptableSelect({
        select: args.select,
        where: {
          id: In(membersIds),
        },
        relations: args.relations,
      }),
    );
    for (const space of spaces) {
      await this.decryptSpace(space);
    }
    return spaces;
  }

  public async findOneByUserIdOrFail(
    args: Parameters<SpacesRepository['findByUserId']>[0],
  ): Promise<Space> {
    const space = await this.findOneByUserId(args);

    if (!space) {
      throw new NotFoundException(
        `Workspace not found. UserId = ${args.userId}`,
      );
    }

    return space;
  }

  public async findOneByUserId(args: {
    userId: number;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null> {
    return await this.findOne({
      where: {
        members: { user: { id: args.userId } },
      },
      select: args.select,
      relations: args.relations,
    });
  }

  public async update(args: {
    id: Space['id'];
    updatePayload: Partial<Pick<Space, 'name' | 'status'>>;
    actorUserId: number;
  }): Promise<Pick<Space, 'uuid'>> {
    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        // Old values are read inside the transaction to keep the diff exact.
        const current = await entityManager.findOne(Space, {
          where: { id: args.id },
          select: {
            id: true,
            uuid: true,
            name: true,
            status: true,
            encryptedDataKey: true,
          },
        });
        if (!current) {
          throw new NotFoundException('Workspace not found.');
        }

        // Decrypt the stored name so the diff and audit payload use plaintext.
        const [currentName] = await this.fieldCrypto.decryptFields(
          { spaceId: String(current.id) },
          current.encryptedDataKey,
          [{ value: current.name, aad: FieldEncryptionAad.SPACE_NAME }],
        );

        // Build the persisted payload, encrypting `name` under the space key.
        const persist: {
          name?: string;
          status?: keyof typeof SpaceStatus;
          encryptedDataKey?: string;
        } = {};
        if (args.updatePayload.status !== undefined) {
          persist.status = args.updatePayload.status;
        }
        if (args.updatePayload.name !== undefined) {
          const { encryptedDataKey, values } =
            await this.fieldCrypto.encryptFields(
              { spaceId: String(current.id) },
              current.encryptedDataKey,
              [
                {
                  value: args.updatePayload.name,
                  aad: FieldEncryptionAad.SPACE_NAME,
                },
              ],
            );
          persist.name = values[0];
          // A space created while encryption was disabled has no key yet.
          if (encryptedDataKey !== null) {
            persist.encryptedDataKey = encryptedDataKey;
          }
        }

        await entityManager
          .createQueryBuilder()
          .update(Space)
          .set(persist)
          .where({ id: args.id })
          .execute();

        const diff = this.diffSpaceUpdate(
          { name: currentName, status: current.status },
          args.updatePayload,
        );
        if (diff) {
          await this.spaceAuditRepository.record(entityManager, {
            spaceId: current.id,
            spaceUuid: current.uuid,
            eventType: SpaceAuditEventType.SPACE_UPDATED,
            actorUserId: args.actorUserId,
            payload: diff,
          });
        }

        return { uuid: current.uuid };
      },
    );
  }

  /** Changed `name`/`status` fields of a space update, or `null` for a no-op. */
  private diffSpaceUpdate(
    current: Pick<Space, 'name' | 'status'>,
    updatePayload: Partial<Pick<Space, 'name' | 'status'>>,
  ): SpaceUpdatedPayload | null {
    const { name, status } = updatePayload;
    const oldFields: SpaceUpdatedPayload['old'] = {};
    const newFields: SpaceUpdatedPayload['new'] = {};

    if (name !== undefined && name !== current.name) {
      oldFields.name = current.name;
      newFields.name = name;
    }
    if (status !== undefined && status !== current.status) {
      oldFields.status = current.status;
      newFields.status = status;
    }

    return Object.keys(newFields).length > 0
      ? { old: oldFields, new: newFields }
      : null;
  }

  public async findIdByUuid(uuid: Space['uuid']): Promise<Space['id']> {
    const space = await this.findOneOrFail({
      where: { uuid },
      select: { id: true },
    });
    return space.id;
  }

  // Resolves the internal numeric id to the client-facing UUID. Mappers hold a
  // numeric spaceId internally and use this to emit the UUID in responses.
  public async findUuidById(id: Space['id']): Promise<Space['uuid']> {
    const space = await this.findOneOrFail({
      where: { id },
      select: { uuid: true },
    });
    return space.uuid;
  }

  // @todo Add a soft delete method
  public async delete(args: {
    id: number;
    actorUserId: number;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const space = await entityManager.findOne(Space, {
        where: { id: args.id },
        select: { id: true, uuid: true, name: true, encryptedDataKey: true },
      });
      if (!space) {
        throw new NotFoundException('Workspace not found.');
      }

      const [name] = await this.fieldCrypto.decryptFields(
        { spaceId: String(space.id) },
        space.encryptedDataKey,
        [{ value: space.name, aad: FieldEncryptionAad.SPACE_NAME }],
      );

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.SPACE_DELETED,
        actorUserId: args.actorUserId,
        payload: { name },
      });

      await entityManager.delete(Space, space.id);
    });
  }

  /**
   * Determines if a user has reached the maximum number of spaces they can create.
   * If the user is member of a space that was not invited by anyone, they are considered to have created that space.
   */
  private async isLimited(userId: number): Promise<boolean> {
    const memberRepository =
      await this.postgresDatabaseService.getRepository(Member);
    const unInvitedMemberships = await memberRepository.find({
      where: { user: { id: userId }, invitedBy: IsNull() },
    });
    return unInvitedMemberships.length >= this.maxSpaceCreationsPerUser;
  }
}

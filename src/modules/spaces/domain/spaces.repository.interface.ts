// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import type { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import type { User } from '@/modules/users/domain/entities/user.entity';

export const ISpacesRepository = Symbol('ISpacesRepository');

export interface ISpacesRepository {
  create(args: {
    userId: User['id'];
    name: string;
    status: keyof typeof SpaceStatus;
  }): Promise<Pick<Space, 'uuid' | 'name'>>;

  findOneOrFail(
    args: Parameters<SpacesRepository['findOne']>[0],
  ): Promise<Space>;

  findOne(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null>;

  findOrFail(
    args: Parameters<SpacesRepository['find']>[0],
  ): Promise<Array<Space>>;

  find(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>>;

  findByUserIdOrFail(
    args: Parameters<SpacesRepository['findByUserId']>[0],
  ): Promise<Array<Space>>;

  findByUserId(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>>;

  findOneByUserIdOrFail(
    args: Parameters<SpacesRepository['findByUserId']>[0],
  ): Promise<Space>;

  findOneByUserId(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null>;

  update(args: {
    id: Space['id'];
    updatePayload: Partial<Pick<Space, 'name' | 'status'>>;
    actorUserId: number;
  }): Promise<Pick<Space, 'uuid'>>;

  findIdByUuid(uuid: Space['uuid']): Promise<Space['id']>;

  // Resolves the internal numeric id to the client-facing UUID for response mapping.
  findUuidById(id: Space['id']): Promise<Space['uuid']>;

  delete(args: { id: number; actorUserId: number }): Promise<void>;
}

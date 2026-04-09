// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';

export const ISpacesRepository = Symbol('ISpacesRepository');

export interface ISpacesRepository {
  create(args: {
    userId: User['id'];
    name: string;
    status: keyof typeof SpaceStatus;
  }): Promise<Pick<Space, 'id' | 'name'>>;

  findOneOrFail(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space>;

  findOne(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null>;

  findOrFail(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>>;

  find(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>>;

  findByUserIdOrFail(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>>;

  findByUserId(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>>;

  findOneByUserIdOrFail(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space>;

  findOneByUserId(args: {
    userId: User['id'];
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null>;

  update(args: {
    id: Space['id'];
    updatePayload: Partial<Pick<Space, 'name' | 'status'>>;
  }): Promise<Pick<Space, 'id'>>;

  delete(id: number): Promise<void>;
}

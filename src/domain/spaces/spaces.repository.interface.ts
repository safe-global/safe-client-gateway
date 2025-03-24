import type { Space } from '@/datasources/spaces/entities/space.entity.db';
import type { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import type { SpacesRepository } from '@/domain/spaces/spaces.repository';
import type { User } from '@/domain/users/entities/user.entity';
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
  }): Promise<Pick<Space, 'id'>>;

  delete(id: number): Promise<void>;
}

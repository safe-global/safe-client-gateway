import type {
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
} from 'typeorm';

export const IEntityRepository = Symbol('IEntityRepository');

export interface IEntityRepository<T extends ObjectLiteral> {
  getRepository(): Promise<Repository<T>>;

  findOneOrFail(args: FindOneOptions<T>): Promise<T>;

  findOne(args: FindOneOptions<T>): Promise<T | null>;

  findOrFail(args?: FindManyOptions<T>): Promise<[T, ...Array<T>]>;

  find(args?: FindManyOptions<T>): Promise<Array<T>>;
}

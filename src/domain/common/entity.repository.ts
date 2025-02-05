import { NotFoundException } from '@nestjs/common';
import type {
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

export class EntityRepository<T extends ObjectLiteral> {
  readonly entity: new () => T;

  protected constructor(
    readonly postgresDatabaseService: PostgresDatabaseService,
    entity: typeof this.entity,
  ) {
    this.entity = entity;
  }

  public async getRepository(): Promise<Repository<T>> {
    return await this.postgresDatabaseService.getRepository(this.entity);
  }

  public async findOneOrFail(args: FindOneOptions<T>): Promise<T> {
    const entity = await this.findOne(args);
    if (entity === null) {
      throw new NotFoundException(`${this.entity.name} not found.`);
    }
    return entity;
  }

  public async findOne(args: FindOneOptions<T>): Promise<T | null> {
    const repository = await this.getRepository();
    return await repository.findOne(args);
  }

  public async findOrFail(
    args?: FindManyOptions<T>,
  ): Promise<[T, ...Array<T>]> {
    const entities = await this.find(args);
    if (entities.length === 0) {
      throw new NotFoundException(`${this.entity.name}s not found.`);
    }
    return entities as [T, ...Array<T>];
  }

  public async find(args?: FindManyOptions<T>): Promise<Array<T>> {
    const repository = await this.getRepository();
    return await repository.find(args);
  }
}

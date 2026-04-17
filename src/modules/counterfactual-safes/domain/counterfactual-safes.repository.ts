// SPDX-License-Identifier: FSL-1.1-MIT
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import type {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import { getAddress } from 'viem';

export class CounterfactualSafesRepository
  implements ICounterfactualSafesRepository
{
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(
    args: Parameters<ICounterfactualSafesRepository['create']>[0],
  ): Promise<void> {
    const repository =
      await this.postgresDatabaseService.getRepository(CounterfactualSafe);

    const itemsToInsert = args.payload.map((item) => ({
      creator: args.creatorId ? { id: args.creatorId } : null,
      chainId: item.chainId,
      address: item.address,
      factoryAddress: item.factoryAddress,
      masterCopy: item.masterCopy,
      saltNonce: item.saltNonce,
      safeVersion: item.safeVersion,
      threshold: item.threshold,
      owners: item.owners.map((owner) => getAddress(owner)),
      fallbackHandler: item.fallbackHandler,
      setupTo: item.setupTo,
      setupData: item.setupData,
      paymentToken: item.paymentToken,
      payment: item.payment,
      paymentReceiver: item.paymentReceiver,
    }));

    try {
      await repository.insert(itemsToInsert);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new UniqueConstraintError(
          'A counterfactual Safe with the same chainId and address already exists.',
        );
      }
      throw err;
    }
  }

  public async findByCreatorId(args: {
    creatorId: User['id'];
  }): Promise<Array<CounterfactualSafe>> {
    const repository =
      await this.postgresDatabaseService.getRepository(CounterfactualSafe);

    return await repository.find({
      where: { creator: { id: args.creatorId } },
    });
  }

  public async findOrFail(
    args: Parameters<CounterfactualSafesRepository['find']>[0],
  ): Promise<Array<CounterfactualSafe>> {
    const results = await this.find(args);

    if (results.length === 0) {
      throw new NotFoundException('Counterfactual Safe not found.');
    }

    return results;
  }

  public async find(args: {
    where:
      | Array<FindOptionsWhere<CounterfactualSafe>>
      | FindOptionsWhere<CounterfactualSafe>;
    select?: FindOptionsSelect<CounterfactualSafe>;
    relations?: FindOptionsRelations<CounterfactualSafe>;
  }): Promise<Array<CounterfactualSafe>> {
    const repository =
      await this.postgresDatabaseService.getRepository(CounterfactualSafe);

    return await repository.find(args);
  }

  public async delete(args: {
    creatorId: User['id'];
    payload: Array<{
      chainId: CounterfactualSafe['chainId'];
      address: CounterfactualSafe['address'];
    }>;
  }): Promise<void> {
    const repository =
      await this.postgresDatabaseService.getRepository(CounterfactualSafe);

    const whereClause: Array<FindOptionsWhere<CounterfactualSafe>> =
      args.payload.map((item) => ({
        creator: { id: args.creatorId },
        chainId: item.chainId,
        address: item.address,
      }));

    const counterfactualSafes = await this.findOrFail({
      where: whereClause,
    });

    if (counterfactualSafes.length !== args.payload.length) {
      throw new BadRequestException(
        `Expected ${args.payload.length} counterfactual Safe(s) to delete, but found ${counterfactualSafes.length}.`,
      );
    }

    await repository.remove(counterfactualSafes);
  }
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { CounterfactualSafeUser } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe-user.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import {
  EntityManager,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import { getAddress, type Address } from 'viem';

type CreateItem = Parameters<
  ICounterfactualSafesRepository['create']
>[0]['payload'][number];

export class CounterfactualSafesRepository implements ICounterfactualSafesRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async create(
    args: Parameters<ICounterfactualSafesRepository['create']>[0],
  ): Promise<void> {
    const normalized = args.payload.map((item) => ({
      ...item,
      owners: item.owners.map((owner) => getAddress(owner)),
    }));

    await this.postgresDatabaseService.transaction(async (manager) => {
      for (const item of normalized) {
        const existing = await manager.findOne(CounterfactualSafe, {
          where: { chainId: item.chainId, address: item.address },
        });

        let counterfactualSafeId: number;

        if (existing) {
          if (!isSameInitParams(existing, item)) {
            throw new UniqueConstraintError(
              'A counterfactual Safe with the same chainId and address already exists with different initialization parameters.',
            );
          }
          counterfactualSafeId = existing.id;
        } else {
          const insertResult = await manager.insert(CounterfactualSafe, {
            creator: args.creatorId ? { id: args.creatorId } : null,
            chainId: item.chainId,
            address: item.address,
            factoryAddress: item.factoryAddress,
            masterCopy: item.masterCopy,
            saltNonce: item.saltNonce,
            safeVersion: item.safeVersion,
            threshold: item.threshold,
            owners: item.owners,
            fallbackHandler: item.fallbackHandler,
            setupTo: item.setupTo,
            setupData: item.setupData,
            paymentToken: item.paymentToken,
            payment: item.payment,
            paymentReceiver: item.paymentReceiver,
          });
          counterfactualSafeId = insertResult.identifiers[0].id as number;
        }

        if (args.creatorId) {
          await this.associateUser(
            manager,
            counterfactualSafeId,
            args.creatorId,
          );
        }
      }
    });
  }

  public async findByUserId(args: {
    userId: User['id'];
  }): Promise<Array<CounterfactualSafe>> {
    const repository =
      await this.postgresDatabaseService.getRepository(CounterfactualSafe);

    return repository
      .createQueryBuilder('cfs')
      .innerJoin(
        CounterfactualSafeUser,
        'cfsu',
        'cfsu.counterfactual_safe_id = cfs.id',
      )
      .where('cfsu.user_id = :userId', { userId: args.userId })
      .getMany();
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
    userId: User['id'];
    payload: Array<{
      chainId: CounterfactualSafe['chainId'];
      address: CounterfactualSafe['address'];
    }>;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (manager) => {
      const targets = await manager
        .createQueryBuilder(CounterfactualSafeUser, 'cfsu')
        .innerJoin(
          CounterfactualSafe,
          'cfs',
          'cfs.id = cfsu.counterfactual_safe_id',
        )
        .where('cfsu.user_id = :userId', { userId: args.userId })
        .andWhere(
          args.payload
            .map(
              (_, i) =>
                `(cfs.chain_id = :chainId${i} AND cfs.address = :address${i})`,
            )
            .join(' OR '),
          args.payload.reduce<Record<string, string>>((acc, item, i) => {
            acc[`chainId${i}`] = item.chainId;
            acc[`address${i}`] = item.address;
            return acc;
          }, {}),
        )
        .select(['cfsu.id'])
        .getMany();

      if (targets.length === 0) {
        throw new NotFoundException('Counterfactual Safe not found.');
      }

      if (targets.length !== args.payload.length) {
        throw new BadRequestException(
          `Expected ${args.payload.length} counterfactual Safe(s) to delete, but found ${targets.length}.`,
        );
      }

      await manager.delete(
        CounterfactualSafeUser,
        targets.map((t) => t.id),
      );
    });
  }

  private async associateUser(
    manager: EntityManager,
    counterfactualSafeId: number,
    userId: User['id'],
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(CounterfactualSafeUser)
      .values({
        counterfactualSafe: { id: counterfactualSafeId },
        user: { id: userId },
      })
      .orIgnore()
      .execute();
  }
}

function isSameInitParams(
  existing: CounterfactualSafe,
  incoming: CreateItem,
): boolean {
  return (
    existing.factoryAddress === incoming.factoryAddress &&
    existing.masterCopy === incoming.masterCopy &&
    existing.saltNonce === incoming.saltNonce &&
    existing.safeVersion === incoming.safeVersion &&
    existing.threshold === incoming.threshold &&
    isSameAddressList(existing.owners, incoming.owners) &&
    existing.fallbackHandler === incoming.fallbackHandler &&
    existing.setupTo === incoming.setupTo &&
    existing.setupData === incoming.setupData &&
    existing.paymentToken === incoming.paymentToken &&
    existing.payment === incoming.payment &&
    existing.paymentReceiver === incoming.paymentReceiver
  );
}

function isSameAddressList(
  a: ReadonlyArray<Address>,
  b: ReadonlyArray<Address>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

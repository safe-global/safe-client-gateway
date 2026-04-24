// SPDX-License-Identifier: FSL-1.1-MIT
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { CounterfactualSafeUser } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe-user.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import {
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
    if (args.payload.length === 0) return;

    // Checksum every address field before comparing against or inserting into
    // the DB: the canonical row is stored checksummed via the TypeORM
    // transformer, so the SELECT-back we do inside the transaction only
    // matches when we look up with the checksummed form too. `getAddress` is
    // a no-op for already-checksummed input and accepts valid lowercase.
    const normalized = args.payload.map((item) => ({
      ...item,
      address: getAddress(item.address),
      factoryAddress: getAddress(item.factoryAddress),
      masterCopy: getAddress(item.masterCopy),
      owners: item.owners.map((owner) => getAddress(owner)),
      fallbackHandler: item.fallbackHandler
        ? getAddress(item.fallbackHandler)
        : null,
      setupTo: item.setupTo ? getAddress(item.setupTo) : null,
      paymentToken: item.paymentToken ? getAddress(item.paymentToken) : null,
      paymentReceiver: item.paymentReceiver
        ? getAddress(item.paymentReceiver)
        : null,
    }));

    await this.postgresDatabaseService.transaction(async (manager) => {
      // Bulk-insert canonical rows. `ON CONFLICT DO NOTHING` makes this
      // race-safe (concurrent POSTs for the same (chainId, address) can't
      // surface a raw 23505) and also harmless for pre-existing rows — in
      // both cases the existing row wins and its stored init params are
      // what the follow-up SELECT will see.
      await manager
        .createQueryBuilder()
        .insert()
        .into(CounterfactualSafe)
        .values(
          normalized.map((item) => ({
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
          })),
        )
        .orIgnore()
        .execute();

      // Single SELECT to fetch the authoritative canonical row for every
      // submitted (chainId, address). Whether each row is newly-inserted or
      // pre-existing is irrelevant from here on — we only care about its id
      // and its stored init params.
      const canonicalRows = await manager
        .createQueryBuilder(CounterfactualSafe, 'cfs')
        .where(
          normalized
            .map(
              (_, i) =>
                `(cfs.chain_id = :chainId${i} AND cfs.address = :address${i})`,
            )
            .join(' OR '),
          normalized.reduce<Record<string, string>>((acc, item, i) => {
            acc[`chainId${i}`] = item.chainId;
            acc[`address${i}`] = item.address;
            return acc;
          }, {}),
        )
        .getMany();

      const rowByKey = new Map<string, CounterfactualSafe>();
      for (const row of canonicalRows) {
        rowByKey.set(`${row.chainId}:${row.address}`, row);
      }

      // Enforce init-params equality per submitted item. A mismatch here
      // means the caller is trying to register a different prediction at an
      // (chainId, address) that's already claimed — a genuine collision.
      for (const item of normalized) {
        const existing = rowByKey.get(`${item.chainId}:${item.address}`);
        if (!existing || !isSameInitParams(existing, item)) {
          throw new UniqueConstraintError(
            'A counterfactual Safe with the same chainId and address already exists with different initialization parameters.',
          );
        }
      }

      // Bulk-insert user associations; per-user idempotency comes from the
      // junction's unique constraint + `ON CONFLICT DO NOTHING`.
      const userId = args.creatorId;
      if (userId !== null && userId !== undefined) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(CounterfactualSafeUser)
          .values(
            canonicalRows.map((row) => ({
              counterfactualSafe: { id: row.id },
              user: { id: userId },
            })),
          )
          .orIgnore()
          .execute();
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

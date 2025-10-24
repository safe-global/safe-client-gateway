import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Asset } from '@/datasources/db/entities/asset.entity.db';
import { AssetIdSchema } from '@/domain/common/entities/asset-identifier.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ZodError } from 'zod';

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetValidationError';
  }
}

export class AssetRepositoryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AssetRepositoryError';
  }
}

export interface IAssetRepository {
  upsert(args: {
    assetId: string;
    symbol: string;
    name: string;
    isCanonical: boolean;
    providerIds: Record<string, string>;
  }): Promise<Asset>;

  findByAssetId(assetId: string): Promise<Asset | null>;

  findByZerionId(zerionId: string): Promise<Asset | null>;

  findAll(): Promise<Array<Asset>>;
}

@Injectable()
export class AssetRepository implements IAssetRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async upsert(args: {
    assetId: string;
    symbol: string;
    name: string;
    isCanonical: boolean;
    providerIds: Record<string, string>;
  }): Promise<Asset> {
    try {
      AssetIdSchema.parse(args.assetId);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AssetValidationError(
          `Invalid asset ID "${args.assetId}": ${error.message}`,
        );
      }
      throw error;
    }

    try {
      const assetRepository =
        await this.postgresDatabaseService.getRepository(Asset);

      const upsertResult = await assetRepository.upsert(
        {
          assetId: args.assetId,
          symbol: args.symbol,
          name: args.name,
          isCanonical: args.isCanonical,
          providerIds: args.providerIds,
        },
        {
          conflictPaths: ['assetId'],
          skipUpdateIfNoValuesChanged: false,
        },
      );

      const assetId =
        upsertResult.identifiers[0]?.id ?? upsertResult.generatedMaps[0]?.id;

      if (!assetId) {
        const existingAsset = await assetRepository.findOne({
          where: { assetId: args.assetId },
        });
        if (existingAsset) {
          return existingAsset;
        }
        throw new Error('Failed to retrieve asset after upsert');
      }

      const asset = await assetRepository.findOne({
        where: { id: assetId },
      });

      if (!asset) {
        throw new Error('Asset not found after upsert');
      }

      return asset;
    } catch (error) {
      throw new AssetRepositoryError(
        `Failed to upsert asset "${args.assetId}"`,
        error,
      );
    }
  }

  public async findByAssetId(assetId: string): Promise<Asset | null> {
    try {
      AssetIdSchema.parse(assetId);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AssetValidationError(
          `Invalid asset ID "${assetId}": ${error.message}`,
        );
      }
      throw error;
    }

    try {
      const assetRepository =
        await this.postgresDatabaseService.getRepository(Asset);

      return await assetRepository.findOne({
        where: { assetId },
      });
    } catch (error) {
      throw new AssetRepositoryError(
        `Failed to find asset by ID "${assetId}"`,
        error,
      );
    }
  }

  public async findByZerionId(zerionId: string): Promise<Asset | null> {
    if (!zerionId || typeof zerionId !== 'string') {
      throw new AssetValidationError('Zerion ID must be a non-empty string');
    }

    try {
      const assetRepository =
        await this.postgresDatabaseService.getRepository(Asset);

      const asset = await assetRepository
        .createQueryBuilder('asset')
        .where("asset.provider_ids->>'zerion' = :zerionId", { zerionId })
        .getOne();

      return asset;
    } catch (error) {
      throw new AssetRepositoryError(
        `Failed to find asset by Zerion ID "${zerionId}"`,
        error,
      );
    }
  }

  public async findAll(): Promise<Array<Asset>> {
    try {
      const assetRepository =
        await this.postgresDatabaseService.getRepository(Asset);

      return await assetRepository.find();
    } catch (error) {
      throw new AssetRepositoryError('Failed to find all assets', error);
    }
  }
}

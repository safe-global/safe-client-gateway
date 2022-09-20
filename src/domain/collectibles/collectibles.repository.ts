import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { Collectible } from './entities/collectible.entity';
import { Page } from '../entities/page.entity';
import { collectibleSchema } from './entities/schemas/collectible.schema';
import { DefinedError, ValidateFunction } from 'ajv';
import { ICollectiblesRepository } from './collectibles.repository.interface';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { JsonSchemaService } from '../schema/json-schema.service';

@Injectable()
export class CollectiblesRepository implements ICollectiblesRepository {
  private readonly isValidCollectible: ValidateFunction<Collectible>;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidCollectible = jsonSchemaService.compile(collectibleSchema);
  }

  async getCollectibles(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>> {
    const transactionApi = await this.transactionApiManager.getTransactionApi(
      chainId,
    );
    const page = await transactionApi.getCollectibles(
      safeAddress,
      limit,
      offset,
      trusted,
      excludeSpam,
    );

    if (
      !page.results.every((collectible: Collectible) =>
        this.isValidCollectible(collectible),
      )
    ) {
      const errors = this.isValidCollectible.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return page;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { backboneSchema } from '../balances/entities/schemas/backbone.schema';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { Backbone } from './entities/backbone.entity';

@Injectable()
export class BackboneRepository {
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidBackbone = this.jsonSchemaService.compile(
      backboneSchema,
    ) as ValidateFunction<Backbone>;
  }

  async getBackbone(chainId: string): Promise<Backbone> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const backbone = await api.getBackbone();

    if (!this.isValidBackbone(backbone)) {
      const errors = this.isValidBackbone.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return backbone;
  }
}

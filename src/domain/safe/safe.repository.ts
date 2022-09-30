import { Inject, Injectable } from '@nestjs/common';
import { Safe } from './entities/safe.entity';
import { DefinedError, ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../schema/json-schema.service';
import { safeSchema } from './entities/schemas/safe.schema';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { ISafeRepository } from './safe.repository.interface';

@Injectable()
export class SafeRepository implements ISafeRepository {
  private readonly isValidSafe: ValidateFunction<Safe>;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidSafe = jsonSchemaService.compile(safeSchema);
  }

  async getSafe(chainId: string, address: string): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safe: Safe = await transactionService.getSafe(address);

    if (!this.isValidSafe(safe)) {
      const errors = this.isValidSafe.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return safe;
  }
}

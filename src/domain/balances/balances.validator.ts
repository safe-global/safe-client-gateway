import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { Balance } from './entities/balance.entity';
import {
  balanceTokenSchema,
  balanceSchema,
} from './entities/schemas/balance.schema';

@Injectable()
export class BalancesValidator implements IValidator<Balance> {
  private readonly isValidBalance: ValidateFunction<Balance>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(balanceTokenSchema, 'balanceToken');
    this.isValidBalance = this.jsonSchemaService.compile(
      balanceSchema,
    ) as ValidateFunction<Balance>;
  }

  validate(data: unknown): Balance {
    if (!this.isValidBalance(data)) {
      const errors = this.isValidBalance.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Balance;
  }
}

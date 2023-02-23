import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Balance } from './entities/balance.entity';
import {
  balanceSchema,
  balanceTokenSchema,
} from './entities/schemas/balance.schema';

@Injectable()
export class BalancesValidator implements IValidator<Balance> {
  private readonly isValidBalance: ValidateFunction<Balance>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/balances/balance-token.json',
      balanceTokenSchema,
    );

    this.isValidBalance = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/balances/balance.json',
      balanceSchema,
    );
  }

  validate(data: unknown): Balance {
    return this.genericValidator.validate(this.isValidBalance, data);
  }
}

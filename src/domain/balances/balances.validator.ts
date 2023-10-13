import { ValidateFunction } from 'ajv';
import { Injectable } from '@nestjs/common';
import { Balance } from '@/domain/balances/entities/balance.entity';
import {
  BALANCE_SCHEMA_ID,
  BALANCE_TOKEN_SCHEMA_ID,
  balanceSchema,
  balanceTokenSchema,
} from '@/domain/balances/entities/schemas/balance.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class BalancesValidator implements IValidator<Balance> {
  private readonly isValidBalance: ValidateFunction<Balance>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      BALANCE_TOKEN_SCHEMA_ID,
      balanceTokenSchema,
    );

    this.isValidBalance = this.jsonSchemaService.getSchema(
      BALANCE_SCHEMA_ID,
      balanceSchema,
    );
  }

  validate(data: unknown): Balance {
    return this.genericValidator.validate(this.isValidBalance, data);
  }
}

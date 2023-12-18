import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import {
  BALANCE_TOKEN_SCHEMA_ID,
  balanceTokenSchema,
} from './entities/schemas/simple-balance.schema';
import {
  SIMPLE_BALANCE_SCHEMA_ID,
  simpleBalanceSchema,
} from './entities/schemas/simple-balance.schema';
import { SimpleBalance } from './entities/simple-balance.entity';

@Injectable()
export class SimpleBalancesValidator implements IValidator<SimpleBalance> {
  private readonly isValidSimpleBalance: ValidateFunction<SimpleBalance>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      BALANCE_TOKEN_SCHEMA_ID,
      balanceTokenSchema,
    );

    this.isValidSimpleBalance = this.jsonSchemaService.getSchema(
      SIMPLE_BALANCE_SCHEMA_ID,
      simpleBalanceSchema,
    );
  }

  validate(data: unknown): SimpleBalance {
    return this.genericValidator.validate(this.isValidSimpleBalance, data);
  }
}

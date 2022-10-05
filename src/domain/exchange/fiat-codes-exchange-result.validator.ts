import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { FiatCodesExchangeResult } from './entities/fiat-codes-exchange-result.entity';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';

@Injectable()
export class FiatCodesExchangeResultValidator
  implements IValidator<FiatCodesExchangeResult>
{
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    private readonly simpleValidator: SimpleValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
  }

  validate(data: unknown): FiatCodesExchangeResult {
    this.simpleValidator.execute(this.isValidFiatCodesExchangeResult, data);
    return data as FiatCodesExchangeResult;
  }
}

import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { RatesExchangeResult } from './entities/rates-exchange-result.entity';
import { ratesExchangeResultSchema } from './entities/schemas/rates-exchange-result.schema';

@Injectable()
export class RatesExchangeResultValidator
  implements IValidator<RatesExchangeResult>
{
  private readonly isValidRatesExchangeResult: ValidateFunction<RatesExchangeResult>;

  constructor(
    private readonly simpleValidator: SimpleValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidRatesExchangeResult = this.jsonSchemaService.compile(
      ratesExchangeResultSchema,
    ) as ValidateFunction<RatesExchangeResult>;
  }

  validate(data: unknown): RatesExchangeResult {
    this.simpleValidator.execute(this.isValidRatesExchangeResult, data);
    return data as RatesExchangeResult;
  }
}

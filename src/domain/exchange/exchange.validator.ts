import { Injectable } from "@nestjs/common";
import { ValidateFunction, DefinedError } from "ajv";
import { JsonSchemaService } from "../../common/schemas/json-schema.service";
import { ValidationErrorFactory } from "../errors/validation-error-factory";
import { IValidator } from "../interfaces/validator.interface";
import { ExchangeResult } from './entities/exchange-result.entity';
import { FiatCodesExchangeResult } from './entities/fiat-codes-result.entity';
import { exchangeResultSchema } from "./entities/schemas/exchange-result.schema";
import { fiatCodesExchangeResultSchema } from "./entities/schemas/fiat-codes-exchange-result.schema";

@Injectable()
export class ExchangeValidator implements IValidator<ExchangeResult | FiatCodesExchangeResult> {
  private readonly isValidExchangeResult: ValidateFunction<ExchangeResult>;
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService
  ) {
    this.isValidExchangeResult = this.jsonSchemaService.compile(
      exchangeResultSchema,
    ) as ValidateFunction<ExchangeResult>;

    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
  }

  isExchangeResult(data: ExchangeResult | FiatCodesExchangeResult): data is ExchangeResult {
    return (data as ExchangeResult).rates !== undefined;
  }

  isFiatCodesExchangeResult(data: ExchangeResult | FiatCodesExchangeResult): data is FiatCodesExchangeResult {
    return (data as FiatCodesExchangeResult).symbols !== undefined;
  }

  validate(data: unknown): ExchangeResult | FiatCodesExchangeResult {
    if (this.isExchangeResult(data as ExchangeResult)) {
      if ( !this.isValidExchangeResult(data)) {
        const errors = this.isValidExchangeResult.errors as DefinedError[];
        throw this.validationErrorFactory.from(errors);
      }
  
      return data as ExchangeResult;
    }

    if ( !this.isValidFiatCodesExchangeResult(data)) {
      const errors = this.isValidFiatCodesExchangeResult.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as FiatCodesExchangeResult;
  }
  validateMany(data: unknown[]): (ExchangeResult | FiatCodesExchangeResult)[] {
    return data.map((item) => this.validate(item));
  }

}
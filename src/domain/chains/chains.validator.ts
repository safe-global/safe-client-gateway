import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { Chain } from './entities/chain.entity';
import {
  nativeCurrencySchema,
  chainSchema,
  blockExplorerUriTemplateSchema,
  gasPriceSchema,
  rpcUriSchema,
  themeSchema,
} from './entities/schemas/chain.schema';

@Injectable()
export class ChainsValidator implements IValidator<Chain> {
  private readonly isValidChain: ValidateFunction<Chain>;

  constructor(
    private readonly simpleValidator: SimpleValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(
      nativeCurrencySchema,
      'nativeCurrencySchema',
    );
    this.jsonSchemaService.addSchema(rpcUriSchema, 'rpcUriSchema');
    this.jsonSchemaService.addSchema(
      blockExplorerUriTemplateSchema,
      'blockExplorerUriTemplateSchema',
    );
    this.jsonSchemaService.addSchema(themeSchema, 'themeSchema');
    this.jsonSchemaService.addSchema(gasPriceSchema, 'gasPriceSchema');
    this.jsonSchemaService.addSchema(nativeCurrencySchema, 'nativeCurrency');
    this.isValidChain = this.jsonSchemaService.compile(
      chainSchema,
    ) as ValidateFunction<Chain>;
  }

  validate(data: unknown): Chain {
    this.simpleValidator.execute(this.isValidChain, data);
    return data as Chain;
  }
}

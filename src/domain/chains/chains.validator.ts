import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { Chain } from './entities/chain.entity';
import {
  blockExplorerUriTemplateSchema,
  chainSchema,
  gasPriceSchema,
  nativeCurrencySchema,
  rpcUriSchema,
  themeSchema,
} from './entities/schemas/chain.schema';

@Injectable()
export class ChainsValidator implements IValidator<Chain> {
  private readonly isValidChain: ValidateFunction<Chain>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/native-currency.json',
      nativeCurrencySchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/rpc-uri.json',
      rpcUriSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/block-explorer-uri-template.json',
      blockExplorerUriTemplateSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/theme.json',
      themeSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/gas-price.json',
      gasPriceSchema,
    );

    this.isValidChain = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/chain.json',
      chainSchema,
    );
  }

  validate(data: unknown): Chain {
    return this.genericValidator.validate(this.isValidChain, data);
  }
}

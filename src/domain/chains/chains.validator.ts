import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Chain } from './entities/chain.entity';
import {
  BLOCK_EXPLORER_URI_TEMPLATE_SCHEMA_ID,
  CHAIN_SCHEMA_ID,
  GAS_PRICE_SCHEMA_ID,
  NATIVE_CURRENCY_SCHEMA_ID,
  RPC_URI_SCHEMA_ID,
  THEME_SCHEMA_ID,
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
      NATIVE_CURRENCY_SCHEMA_ID,
      nativeCurrencySchema,
    );

    this.jsonSchemaService.getSchema(RPC_URI_SCHEMA_ID, rpcUriSchema);

    this.jsonSchemaService.getSchema(
      BLOCK_EXPLORER_URI_TEMPLATE_SCHEMA_ID,
      blockExplorerUriTemplateSchema,
    );

    this.jsonSchemaService.getSchema(THEME_SCHEMA_ID, themeSchema);

    this.jsonSchemaService.getSchema(GAS_PRICE_SCHEMA_ID, gasPriceSchema);

    this.isValidChain = this.jsonSchemaService.getSchema(
      CHAIN_SCHEMA_ID,
      chainSchema,
    );
  }

  validate(data: unknown): Chain {
    return this.genericValidator.validate(this.isValidChain, data);
  }
}

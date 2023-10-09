import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { AssetPrice } from './entities/asset-price.entity';
import {
  ASSET_PRICE_SCHEMA_ID,
  assetPriceSchema,
} from './entities/schemas/asset-price.schema';

@Injectable()
export class AssetPriceValidator implements IValidator<AssetPrice> {
  private readonly isValidAssetPrice: ValidateFunction<AssetPrice>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.isValidAssetPrice = this.jsonSchemaValidator.getSchema(
      ASSET_PRICE_SCHEMA_ID,
      assetPriceSchema,
    );
  }

  validate(data: unknown): AssetPrice {
    return this.genericValidator.validate(this.isValidAssetPrice, data);
  }
}

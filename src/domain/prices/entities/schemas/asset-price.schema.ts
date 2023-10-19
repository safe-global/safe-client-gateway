import { Schema } from 'ajv';

export const ASSET_PRICE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/prices/asset-price.json';

export const assetPriceSchema: Schema = {
  $id: ASSET_PRICE_SCHEMA_ID,
  type: 'object',
  minProperties: 1,
};

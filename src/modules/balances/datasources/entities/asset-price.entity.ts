import { z } from 'zod';
import { NullableNumberSchema } from '@/validation/entities/schemas/nullable.schema';

export type AssetPrice = z.infer<ReturnType<typeof getAssetPriceSchema>>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getAssetPriceSchema<const T extends string>(
  lowerCaseFiatCode: T,
) {
  return z.record(
    z.string(),
    z.object({
      [lowerCaseFiatCode]: NullableNumberSchema,
      [`${lowerCaseFiatCode}_24h_change`]: NullableNumberSchema,
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getAssetPricesSchema<const T extends string>(
  lowerCaseFiatCode: T,
) {
  const AssetPriceSchema = getAssetPriceSchema(lowerCaseFiatCode);
  return z.array(AssetPriceSchema);
}

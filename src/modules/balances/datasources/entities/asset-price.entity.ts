import { z } from 'zod';

export type AssetPrice = z.infer<ReturnType<typeof getAssetPriceSchema>>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getAssetPriceSchema<const T extends string>(
  lowerCaseFiatCode: T,
) {
  return z.record(
    z.object({
      [lowerCaseFiatCode]: z.number().nullish().default(null),
      [`${lowerCaseFiatCode}_24h_change`]: z.number().nullish().default(null),
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

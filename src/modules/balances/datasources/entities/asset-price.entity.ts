// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { NullableNumberSchema } from '@/validation/entities/schemas/nullable.schema';

export type AssetPrice = z.infer<ReturnType<typeof getAssetPriceSchema>>;

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

export function getAssetPricesSchema<const T extends string>(
  lowerCaseFiatCode: T,
) {
  const AssetPriceSchema = getAssetPriceSchema(lowerCaseFiatCode);
  return z.array(AssetPriceSchema);
}

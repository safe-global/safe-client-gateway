import { z } from 'zod';

export type AssetPrice = z.infer<typeof AssetPriceSchema>;

// TODO: Enforce Ethereum address keys (and maybe checksum them)
export const AssetPriceSchema = z.record(z.record(z.number().nullable()));

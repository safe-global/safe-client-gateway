import z from 'zod';

export const GasPriceResultSchema = z.object({
  LastBlock: z.string(),
  SafeGasPrice: z.string(),
  ProposeGasPrice: z.string(),
  FastGasPrice: z.string(),
  suggestBaseFee: z.string(),
  gasUsedRatio: z.string(),
});

export const GasPriceResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: GasPriceResultSchema,
});

export type GasPriceResponse = z.infer<typeof GasPriceResponseSchema>;
export type GasPriceResult = z.infer<typeof GasPriceResultSchema>;

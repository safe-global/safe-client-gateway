import { z } from 'zod';

export const DataDecodedParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  // z.unknown() makes the property optional but it should be defined
  value: z.custom<Required<unknown>>(),
  valueDecoded: z
    .union([z.record(z.unknown()), z.array(z.record(z.unknown()))])
    .nullish()
    .default(null),
});

export const DataDecodedSchema = z.object({
  method: z.string(),
  parameters: z.array(DataDecodedParameterSchema).nullish().default(null),
});

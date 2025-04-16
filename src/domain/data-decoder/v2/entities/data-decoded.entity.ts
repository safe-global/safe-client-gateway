import { z } from 'zod';
import { AddressSchema as _AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema as _HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';

// ZodEffects cannot be recursively inferred and need be casted
const AddressSchema = _AddressSchema as z.ZodType<`0x${string}`>;
const HexSchema = _HexSchema as z.ZodType<`0x${string}`>;

export const MultisendSchema = z.object({
  operation: z.nativeEnum(Operation),
  value: NumericStringSchema,
  dataDecoded: z.lazy(() => BaseDataDecodedSchema.nullable()),
  to: AddressSchema,
  data: HexSchema.nullable(),
});

export const ValueDecodedSchema = z.union([
  z.array(z.lazy(() => MultisendSchema)),
  z.lazy(() => BaseDataDecodedSchema),
  z.null(),
]);

export const DataDecodedParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  // z.unknown() makes the property optional but it should be defined
  value: z.custom<Required<unknown>>(),
  valueDecoded: ValueDecodedSchema.optional(),
});

export const BaseDataDecodedSchemaShape = {
  method: z.string(),
  parameters: z.array(z.lazy(() => DataDecodedParameterSchema)).nullable(),
};

// We need explicitly define ZodType due to recursion
export const BaseDataDecodedSchema: z.ZodType<{
  method: string;
  parameters: Array<z.infer<typeof DataDecodedParameterSchema>> | null;
}> = z.lazy(() => z.object(BaseDataDecodedSchemaShape));

export const DataDecodedAccuracy = [
  'FULL_MATCH', // Matched contract and chain ID
  'PARTIAL_MATCH', // Matched contract
  'ONLY_FUNCTION_MATCH', // Matched function from another contract
  'NO_MATCH', // Selector cannot be decoded
] as const;

export const DataDecodedSchema = z.lazy(() =>
  z.object(BaseDataDecodedSchemaShape).extend({
    accuracy: z.enum([...DataDecodedAccuracy, 'UNKNOWN']).catch('UNKNOWN'),
  }),
);

export type MultiSend = z.infer<typeof MultisendSchema>;

export type DataDecodedParameter = z.infer<typeof DataDecodedParameterSchema>;

export type BaseDataDecoded = z.infer<typeof BaseDataDecodedSchema>;

export type DataDecoded = z.infer<typeof DataDecodedSchema>;

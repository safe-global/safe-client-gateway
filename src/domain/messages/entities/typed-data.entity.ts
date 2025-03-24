import { z } from 'zod';
import {
  TypedDataDomain as TypedDataDomainSchema,
  TypedDataParameter as TypedDataParameterSchema,
} from 'abitype/zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

// Overwrite chainId and salt for strictness
const _TypedDataDomainSchema = TypedDataDomainSchema.merge(
  z.object({
    chainId: z.coerce.number().optional(),
    salt: HexSchema.optional(),
  }),
);

export const TypedDataSchema = z.object({
  domain: _TypedDataDomainSchema,
  primaryType: z.string(),
  types: z.record(z.array(TypedDataParameterSchema)),
  message: z.record(z.unknown()),
});

export type TypedData = z.infer<typeof TypedDataSchema>;

import { z } from 'zod';
import {
  TypedDataDomain as TypedDataDomainSchema,
  TypedDataParameter as TypedDataParameterSchema,
} from 'abitype/zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const _TypedDataDomainSchema = z.object({
  name: TypedDataDomainSchema.shape.name.or(z.literal('')),
  version: TypedDataDomainSchema.shape.version,
  // Overwrite chainId, salt and address for strictness/checksumming
  chainId: z.coerce.number().optional(),
  salt: HexSchema.optional(),
  verifyingContract: AddressSchema.optional(),
});

export const TypedDataSchema = z.object({
  domain: _TypedDataDomainSchema,
  primaryType: z.string(),
  types: z.record(z.array(TypedDataParameterSchema)),
  message: z.record(z.unknown()),
});

export type TypedData = z.infer<typeof TypedDataSchema>;

// SPDX-License-Identifier: FSL-1.1-MIT
import {
  TypedDataDomain as TypedDataDomainSchema,
  TypedDataParameter as TypedDataParameterSchema,
} from 'abitype/zod';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const _TypedDataDomainSchema = z.object({
  name: z.union([TypedDataDomainSchema.shape.name, z.literal('')]),
  version: TypedDataDomainSchema.shape.version,
  // Overwrite chainId, salt and address for strictness/checksumming
  chainId: z.coerce.number().optional(),
  salt: HexSchema.optional(),
  verifyingContract: AddressSchema.optional(),
});

export const TypedDataSchema = z.object({
  domain: _TypedDataDomainSchema,
  primaryType: z.string(),
  types: z.record(z.string(), z.array(TypedDataParameterSchema)),
  message: z.record(z.string(), z.unknown()),
});

export type TypedData = z.infer<typeof TypedDataSchema>;

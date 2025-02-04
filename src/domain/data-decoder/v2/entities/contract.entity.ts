import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const ProjectSchema = z.object({
  description: z.string(),
  logoFile: z.string().url(),
});

export const AbiSchema = z.object({
  // We could use abitype here, but we don't consume the ABI/it would increase entity complexity
  abiJson: z.array(z.record(z.unknown())),
  abiHash: HexSchema,
  modified: z.coerce.date(),
});

export const ContractSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  displayName: z.string().nullable(),
  chainId: z.number().transform(String),
  project: ProjectSchema.nullable(),
  abi: AbiSchema,
  modified: z.coerce.date(),
});

export type Contract = z.infer<typeof ContractSchema>;

export const ContractPageSchema = buildPageSchema(ContractSchema);

export type ContractPage = z.infer<typeof ContractPageSchema>;

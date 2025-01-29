import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const ProjectSchema = z.object({
  description: z.string(),
  logo_file: z.string().url(),
});

export const AbiSchema = z.object({
  // We could use abitype here, but we don't consume the ABI/it would increase entity complexity
  abi_json: z.array(z.record(z.unknown())),
  abi_hash: HexSchema,
  modified: z.coerce.date(),
});

export const ContractSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  display_name: z.string().nullable(),
  chain_id: z.number().transform(String),
  project: ProjectSchema.nullable(),
  abi: AbiSchema,
  modified: z.coerce.date(),
});

export type Contract = z.infer<typeof ContractSchema>;

export const ContractPageSchema = buildPageSchema(ContractSchema);

export type ContractPage = z.infer<typeof ContractPageSchema>;

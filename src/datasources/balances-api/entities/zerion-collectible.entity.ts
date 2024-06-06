import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type ZerionCollectionInfo = z.infer<typeof ZerionCollectionInfoSchema>;

export type ZerionNFTInfo = z.infer<typeof ZerionNFTInfoSchema>;

export type ZerionCollectibleAttributes = z.infer<
  typeof ZerionCollectibleAttributesSchema
>;

export type ZerionCollectible = z.infer<typeof ZerionCollectibleSchema>;

export type ZerionCollectibles = z.infer<typeof ZerionCollectiblesSchema>;

const ZerionCollectionInfoSchema = z.object({
  content: z
    .object({
      icon: z.object({
        url: z.string(),
      }),
      banner: z.object({
        url: z.string(),
      }),
    })
    .nullable(),
  description: z.string().nullable(),
  name: z.string().nullable(),
});

const ZerionNFTInfoSchema = z.object({
  content: z
    .object({
      preview: z
        .object({
          url: z.string(),
        })
        .nullable(),
      detail: z
        .object({
          url: z.string(),
        })
        .nullable(),
    })
    .nullable(),
  contract_address: AddressSchema,
  flags: z
    .object({
      is_spam: z.boolean(),
    })
    .nullable(),
  interface: z.string().nullable(),
  name: z.string().nullable(),
  token_id: z.string(),
});

const ZerionCollectibleAttributesSchema = z.object({
  amount: z.string(),
  changed_at: z.coerce.date(),
  collection_info: ZerionCollectionInfoSchema.nullable(),
  nft_info: ZerionNFTInfoSchema,
  price: z.number(),
  value: z.number(),
});

const ZerionCollectibleSchema = z.object({
  attributes: ZerionCollectibleAttributesSchema,
  id: z.string(),
  type: z.literal('nft_positions'),
});

export const ZerionCollectiblesSchema = z.object({
  data: z.array(ZerionCollectibleSchema),
  links: z.object({
    next: z.string().nullable(),
  }),
});

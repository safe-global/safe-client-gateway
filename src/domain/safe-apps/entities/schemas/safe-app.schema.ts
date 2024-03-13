import { z } from 'zod';

export const SafeAppAccessControlSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(SafeAppAccessControlPolicies.DomainAllowlist),
    value: z.array(z.string().url()).nullish().default(null),
  }),
  z.object({
    type: z.literal(SafeAppAccessControlPolicies.NoRestrictions),
  }),
  z.object({
    type: z.literal(SafeAppAccessControlPolicies.Unknown),
  }),
]);

export const SafeAppSocialProfileSchema = z.object({
  platform: z.string(),
  url: z.string().url(),
});

export const SafeAppProviderSchema = z.object({
  url: z.string().url(),
  name: z.string(),
});

export const SafeAppSchema = z.object({
  id: z.number(),
  url: z.string().url(),
  name: z.string(),
  description: z.string(),
  chainIds: z.array(z.number()),
  accessControl: SafeAppAccessControlSchema,
  tags: z.array(z.string()),
  features: z.array(z.string()),
  socialProfiles: z.array(SafeAppSocialProfileSchema),
  iconUrl: z.string().url().nullish().default(null),
  provider: SafeAppProviderSchema.nullish().default(null),
  developerWebsite: z.string().url().nullish().default(null),
});

// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const DECLARED_CHANNEL_MAX_LENGTH = 64;
export const DECLARED_APP_NAME_MAX_LENGTH = 256;
export const DECLARED_APP_URL_MAX_LENGTH = 2048;

/**
 * Channels wallet clients declare. Documentation only: any string is accepted
 * and forwarded.
 */
export const KnownDeclaredChannels = [
  'NATIVE_TRANSFER',
  'NATIVE_BATCH',
  'SAFE_APP',
  'WALLET_CONNECT',
  'WIDGET',
  'DIRECT',
  'MCP',
  'CLI',
] as const;

/** Removes NUL characters and cuts the value to `maxLength` characters. */
function truncateDeclaredText(value: string, maxLength: number): string {
  const characters = Array.from(value.replaceAll('\u0000', ''));
  return characters.length > maxLength
    ? characters.slice(0, maxLength).join('')
    : characters.join('');
}

function declaredTextSchema(maxLength: number) {
  return z
    .string()
    .transform((value) => truncateDeclaredText(value, maxLength))
    .nullish()
    .default(null)
    .catch(null);
}

/**
 * Attribution the client declares on a transaction or message proposal.
 */
export const DeclaredAttributionSchema = z.object({
  channel: declaredTextSchema(DECLARED_CHANNEL_MAX_LENGTH),
  appName: declaredTextSchema(DECLARED_APP_NAME_MAX_LENGTH),
  appUrl: declaredTextSchema(DECLARED_APP_URL_MAX_LENGTH),
  appId: z.number().int().positive().nullish().default(null).catch(null),
});

export type DeclaredAttribution = z.infer<typeof DeclaredAttributionSchema>;

/**
 * The `declared` field of a proposal. It never fails the proposal: anything
 * that isn't an object becomes `null`.
 */
export const NullableDeclaredAttributionSchema =
  DeclaredAttributionSchema.nullish().default(null).catch(null);

/**
 * Swagger descriptions shared by every request DTO that carries
 * {@link DeclaredAttribution}.
 */
export const DeclaredAttributionDescriptions: Record<
  'declared' | keyof DeclaredAttribution,
  string
> = {
  declared: 'Client-declared attribution.',
  channel: `Known values: ${KnownDeclaredChannels.join(', ')}. Truncated to ${DECLARED_CHANNEL_MAX_LENGTH} characters.`,
  appName: `App name. Truncated to ${DECLARED_APP_NAME_MAX_LENGTH} characters.`,
  appUrl: `App origin and path. Truncated to ${DECLARED_APP_URL_MAX_LENGTH} characters.`,
  appId: 'ID of a listed Safe App.',
};

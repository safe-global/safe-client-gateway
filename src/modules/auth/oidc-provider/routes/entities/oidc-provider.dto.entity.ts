// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * Query parameters of the OAuth 2.0/OIDC authorization endpoint.
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
 */
export const AuthorizeQuerySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string(),
  redirect_uri: z.string(),
  scope: z.string().optional(),
  state: z.string().optional(),
  // OIDC nonce (relying party replay protection), not the SiWe nonce
  nonce: z.string().optional(),
});

export type AuthorizeQuery = z.infer<typeof AuthorizeQuerySchema>;

/**
 * Payload sent by the sign-in page after the user signed the SiWe message.
 */
export class OidcSignInDto implements z.infer<typeof OidcSignInDtoSchema> {
  @ApiProperty()
  request_id!: string;
  @ApiProperty()
  message!: string;
  @ApiProperty()
  signature!: Address;

  constructor(props: OidcSignInDto) {
    this.request_id = props.request_id;
    this.message = props.message;
    this.signature = props.signature;
  }
}

export const OidcSignInDtoSchema = z.object({
  request_id: z.string(),
  message: z.string(),
  signature: HexSchema,
});

/**
 * Body of the OAuth 2.0 token endpoint (application/x-www-form-urlencoded).
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
 */
export class TokenRequestDto implements z.infer<typeof TokenRequestDtoSchema> {
  @ApiProperty()
  grant_type!: 'authorization_code';
  @ApiProperty()
  code!: string;
  @ApiPropertyOptional()
  redirect_uri?: string;
  @ApiPropertyOptional()
  client_id?: string;
  @ApiPropertyOptional()
  client_secret?: string;

  constructor(props: TokenRequestDto) {
    this.grant_type = props.grant_type;
    this.code = props.code;
    this.redirect_uri = props.redirect_uri;
    this.client_id = props.client_id;
    this.client_secret = props.client_secret;
  }
}

export const TokenRequestDtoSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  redirect_uri: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

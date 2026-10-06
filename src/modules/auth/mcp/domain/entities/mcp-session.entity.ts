// SPDX-License-Identifier: FSL-1.1-MIT

import type { User } from '@/modules/users/domain/entities/user.entity';

export const MCP_SESSION_REQUEST_PROPERTY = 'mcpSession';

/**
 * The caller of an MCP request, resolved from a verified Auth0 access token.
 */
export type McpSession = {
  userId: User['id'];
  /** The Auth0 client of this connection (`azp`), if the token names one. */
  clientId: string | undefined;
  /** Epoch seconds of the last second-factor challenge, if Auth0 recorded one. */
  mfaVerifiedAt: number | undefined;
  expiresAt: Date | undefined;
};

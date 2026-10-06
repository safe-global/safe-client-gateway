// SPDX-License-Identifier: FSL-1.1-MIT

import type { McpElevationRequest } from '@/modules/auth/mcp/domain/entities/mcp-elevation-request.entity';

export const IMcpElevationRepository = Symbol('IMcpElevationRepository');

export interface IMcpElevationRepository {
  /**
   * Stores a pending step-up for the connection and returns its id, which the
   * user carries through the OIDC step-up flow.
   */
  createRequest(request: McpElevationRequest): Promise<string>;

  /**
   * Returns and deletes a pending step-up, so each id completes at most once.
   */
  consumeRequest(requestId: string): Promise<McpElevationRequest | null>;

  /**
   * Records that the user presented a second factor for this connection.
   */
  setElevated(
    args: McpElevationRequest & { verifiedAt: number },
  ): Promise<void>;

  /**
   * Epoch seconds of the connection's last completed step-up, if still within
   * the elevation window.
   */
  getElevatedAt(args: McpElevationRequest): Promise<number | null>;
}

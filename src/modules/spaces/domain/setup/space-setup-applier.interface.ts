// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '#/modules/spaces/domain/entities/space.entity';

export const ISpaceSetupApplier = Symbol('ISpaceSetupApplier');

/**
 * Applies a Workspace's pending setup. The implementation lives in `routes/`
 * (it reuses the Safes and members route services); this is what the
 * subscription sync depends on instead.
 */
export interface ISpaceSetupApplier {
  /**
   * Adds the setup's Safes, contacts and invites and saves its survey, then
   * marks it applied. Does nothing when the space has no pending setup, so it
   * is safe to call more than once.
   */
  apply(spaceId: Space['id']): Promise<void>;
}

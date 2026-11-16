// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '#/modules/spaces/domain/entities/space.entity';

export const SPACE_SETUP_CHECKOUT_FAILED_MESSAGE =
  'The Workspace was created, but the checkout could not start. Try again.';

/**
 * The Workspace and its setup are stored, but no checkout started. Carries
 * the Workspace's id so the client retries on it instead of creating
 * another one.
 */
export class SpaceSetupCheckoutFailedError extends Error {
  public constructor(
    public readonly spaceUuid: Space['uuid'],
    cause: unknown,
  ) {
    super(SPACE_SETUP_CHECKOUT_FAILED_MESSAGE, { cause });
  }
}

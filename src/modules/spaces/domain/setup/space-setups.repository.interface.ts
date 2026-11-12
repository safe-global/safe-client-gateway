// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import type {
  SpaceSetup,
  SpaceSetupPayload,
  SpaceSetupStatus,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';

export const ISpaceSetupsRepository = Symbol('ISpaceSetupsRepository');

/** The `space_setups` table; payloads are encrypted here, never by callers. */
export interface ISpaceSetupsRepository {
  /** Inserts a pending setup in the caller's transaction. */
  createPending(args: {
    spaceId: Space['id'];
    paymentLinkId: string | null;
    payload: SpaceSetupPayload;
    entityManager: EntityManager;
  }): Promise<void>;

  findBySpaceId(spaceId: Space['id']): Promise<SpaceSetup | null>;

  /** Status and plan only: no payload, so no decryption. */
  findStateBySpaceId(
    spaceId: Space['id'],
  ): Promise<Pick<SpaceSetup, 'status' | 'paymentLinkId'> | null>;

  /**
   * {@link findBySpaceId} that locks the row until `entityManager`'s
   * transaction ends, so a concurrent claim or replace waits for this one.
   */
  findBySpaceIdForUpdate(
    spaceId: Space['id'],
    entityManager: EntityManager,
  ): Promise<SpaceSetup | null>;

  /** Setup status per space, in one query; a space with no setup is absent. */
  findStatusesBySpaceIds(
    spaceIds: Array<Space['id']>,
  ): Promise<Map<Space['id'], keyof typeof SpaceSetupStatus>>;

  /** Replaces the plan and payload of the space's setup. */
  replace(args: {
    spaceId: Space['id'];
    paymentLinkId: string | null;
    payload: SpaceSetupPayload;
    entityManager: EntityManager;
  }): Promise<void>;

  /**
   * Moves a claimable setup to APPLYING in a short transaction of its own, so
   * one caller applies it. `null` when there is nothing to claim: no setup,
   * one applied, or one another apply holds within its lease.
   */
  claim(args: {
    spaceId: Space['id'];
    leaseSeconds: number;
  }): Promise<SpaceSetup | null>;

  /** Moves a claimed (APPLYING) setup to APPLIED. */
  markApplied(spaceId: Space['id']): Promise<void>;
}

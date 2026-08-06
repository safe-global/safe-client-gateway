// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const ISpaceSeatSelectionRepository = Symbol(
  'ISpaceSeatSelectionRepository',
);

/** Queries over the `space_seat_selection` table. */
export interface ISpaceSeatSelectionRepository {
  /**
   * Ids of the Safes the admin explicitly chose to cover, oldest selection
   * first. Empty until a selection is edited.
   */
  getSelectedSpaceSafeIds(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<Array<number>>;

  deleteSelectionBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<void>;

  createSelection(
    args: { spaceId: Space['id']; spaceSafeIds: Array<number> },
    entityManager?: EntityManager,
  ): Promise<void>;
}

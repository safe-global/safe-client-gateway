// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';

/** Which stored roots still count toward the per-Space, per-Safe cap. */
export type ActiveRootsRule = {
  /** Roots known on-chain, mapped to whether they can still be applied. */
  onChain: ReadonlyMap<Hex, boolean>;
  /** Drafts created before this no longer count; `null` counts every draft. */
  draftsSince: Date | null;
};

/** Counts every stored root. */
export const EVERY_ROOT_ACTIVE: ActiveRootsRule = {
  onChain: new Map(),
  draftsSince: null,
};

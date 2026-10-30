// SPDX-License-Identifier: FSL-1.1-MIT
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';

/** A Safe together with the chain it was loaded from. */
export type ChainSafe = {
  chainId: string;
  safe: Safe;
};

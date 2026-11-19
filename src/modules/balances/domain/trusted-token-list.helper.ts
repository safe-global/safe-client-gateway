// SPDX-License-Identifier: FSL-1.1-MIT
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';

/** Chain feature that marks a chain as having a default (curated) token list. */
export const DEFAULT_TOKEN_LIST_FEATURE = 'DEFAULT_TOKENLIST';

/**
 * The `trusted` value to send to the Transaction Service. Only a chain with a
 * default token list has a curated list to filter by, so everywhere else it
 * asks for all tokens, the same rule the web app applies.
 *
 * @param args.chain - The chain the balances are read on
 * @param args.trusted - The value the client asked for
 * @returns `args.trusted` on a chain with a default token list, otherwise false
 */
export function getTxServiceTrusted(args: {
  chain: Chain;
  trusted: boolean;
}): boolean {
  return (
    args.trusted && args.chain.features.includes(DEFAULT_TOKEN_LIST_FEATURE)
  );
}

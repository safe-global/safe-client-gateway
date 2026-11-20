// SPDX-License-Identifier: FSL-1.1-MIT
import { parseAbi, toFunctionSelector } from 'viem';

/** The ERC-20 functions that set or change an allowance for a spender. */
export const ALLOWANCE_FUNCTIONS_ABI = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function increaseAllowance(address spender, uint256 addedValue)',
  'function decreaseAllowance(address spender, uint256 subtractedValue)',
]);

export const ALLOWANCE_FUNCTION_SELECTORS = ALLOWANCE_FUNCTIONS_ABI.map(
  (item) => toFunctionSelector(item),
);

/** The largest page the Transaction Service serves for a history list. */
export const HISTORY_PAGE_SIZE = 200;

/** Multicall3 is deployed at the same address on every chain that has it. */
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

/**
 * Calldata bytes per Multicall3 request. viem's default (1,024) splits a few
 * hundred `allowance` calls into dozens of requests.
 */
export const MULTICALL_BATCH_SIZE_BYTES = 32_768;

// SPDX-License-Identifier: FSL-1.1-MIT

/** Multicall3 is deployed at the same address on every chain that has it. */
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

/**
 * Calldata bytes per Multicall3 request. viem's default (1,024) splits a few
 * hundred `allowance` calls into dozens of requests.
 */
export const MULTICALL_BATCH_SIZE_BYTES = 32_768;

/** ERC-20 indexes the owner and the spender; ERC-721 also indexes the token id. */
export const ERC20_APPROVAL_TOPIC_COUNT = 3;

/** The approved `uint256` value. */
export const ERC20_APPROVAL_DATA_BYTES = 32;

/** The newest blocks can still be replaced, so every scan reads them again. */
export const RESCAN_BLOCKS = 64;

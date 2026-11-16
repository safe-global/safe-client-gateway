// SPDX-License-Identifier: FSL-1.1-MIT
import { zeroAddress } from 'viem';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

export const SAFENET_CHAIN_ID = '100';
export const SUPPORTED_SAFE_VERSION = '1.4.1';
export const EXECUTION_SUCCESS_TOPIC =
  '0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e';

/** Relay task status codes. */
export const RELAY_STATUS_PENDING = 100;
export const RELAY_STATUS_INCLUDED = 200;
export const RELAY_STATUS_REJECTED = 400;
export const RELAY_STATUS_REVERTED = 500;

/** Empty `extraData` for `proposeTransaction`: the oracle needs none. */
export const NO_EXTRA_DATA = '0x';

/** `execTransaction` arguments after `data`: CALL, no gas, no refund. */
export const NO_REFUND_EXEC_ARGS = [
  Operation.CALL,
  0n,
  0n,
  0n,
  zeroAddress,
  zeroAddress,
] as const;

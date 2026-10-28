// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const HASH = '(0x)?[0-9a-fA-F]{64}';
const ADDRESS = '0x[0-9a-fA-F]{40}';
const UPSTREAM_ID = '[0-9A-Za-z,]+';

export const TransactionIdSchema = z
  .string()
  .regex(
    new RegExp(
      `^(?:${HASH}|multisig_${ADDRESS}_${HASH}|module_${ADDRESS}_${UPSTREAM_ID}|transfer_${ADDRESS}_${UPSTREAM_ID})$`,
    ),
  );

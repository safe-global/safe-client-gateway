// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * The maximum safe integer for the database.
 * This is the maximum value that can be stored in the database for an integer column.
 * Ref: https://www.postgresql.org/docs/16/datatype-numeric.html
 */
export const DB_MAX_SAFE_INTEGER = 2 ** 31 - 1;

/**
 * The default pagination limit on the Safe Transaction Service.
 * Ref: https://github.com/safe-global/safe-transaction-service/blob/491be54c7f9a15bed352469d0764ce06cb012561/safe_transaction_service/contracts/pagination.py#L5
 */
export const SAFE_TRANSACTION_SERVICE_MAX_LIMIT = 200;

/**
 * Matches a canonical UUID (8-4-4-4-12 hex), case-insensitive.
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Matches a non-negative integer string (digits only).
 */
export const NUMERIC_REGEX = /^\d+$/;

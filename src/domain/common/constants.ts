/**
 * The maximum safe integer for the database.
 * This is the maximum value that can be stored in the database for an integer column.
 * Ref: https://www.postgresql.org/docs/16/datatype-numeric.html
 */
export const DB_MAX_SAFE_INTEGER = Math.pow(2, 31) - 1;

/**
 * The default pagination limit on the Safe Transaction Service.
 * Ref: https://github.com/safe-global/safe-transaction-service/blob/491be54c7f9a15bed352469d0764ce06cb012561/safe_transaction_service/contracts/pagination.py#L5
 */
export const SAFE_TRANSACTION_SERVICE_MAX_LIMIT = 200;

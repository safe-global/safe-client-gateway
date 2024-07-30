/**
 * The maximum safe integer for the database.
 * This is the maximum value that can be stored in the database for an integer column.
 * Ref: https://www.postgresql.org/docs/16/datatype-numeric.html
 */
export const DB_MAX_SAFE_INTEGER = Math.pow(2, 31) - 1;

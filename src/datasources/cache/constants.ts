/**
 * The {@link CacheKeyPrefix} is meant to be used whenever a prefix should be added to the keys
 * registered in the cache.
 *
 * This is useful in scenarios like:
 * - Multiple instances of the service can use the same Redis instance and use the prefix as a "data partition"
 * - Testing scenario where tests run concurrently – concurrent runs might affect the state of other tests given
 * that a cache instance might be shared between the tests.
 */
export const CacheKeyPrefix = Symbol('CacheKeyPrefix');

/**
 * This number is used to set the maximum TTL for a key in Redis.
 * A safe JS value is used to prevent overflow errors. This value in milliseconds equals to 285420 years.
 *
 * Note: The maximum value allowed by Redis is higher: LLONG_MAX (C's long long int, 2**63-1) minus the unix epoch in milliseconds.
 * Ref: https://github.com/redis/redis/blob/cc244370a2d622d5d2fec5573ae87de6c59ed3b9/src/expire.c#L573
 */
export const MAX_TTL = Number.MAX_SAFE_INTEGER - 1;

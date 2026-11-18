// SPDX-License-Identifier: FSL-1.1-MIT

// Compare and write atomically so a delayed batch cannot roll back a newer marker.
export const SET_INVALIDATION_TIME_SCRIPT = `
local current = tonumber(redis.call('HGET', KEYS[1], ''))
if not current or current < tonumber(ARGV[1]) then
  return redis.call('HSET', KEYS[1], '', ARGV[1])
end
return 0
`;

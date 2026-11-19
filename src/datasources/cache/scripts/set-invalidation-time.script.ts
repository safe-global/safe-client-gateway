// SPDX-License-Identifier: FSL-1.1-MIT

// Compare and write atomically so a delayed batch cannot roll back a newer marker.
export const SET_INVALIDATION_TIME_SCRIPT = `
local value = redis.pcall('HGET', KEYS[1], '')
if type(value) == 'table' and value.err then
  -- Bound the lifetime of a malformed marker, as the pipeline did previously.
  if string.match(value.err, '^WRONGTYPE') then
    redis.call('EXPIRE', KEYS[1], ARGV[2], 'NX')
  end
  return value
end
local current = tonumber(value)
if current and current >= tonumber(ARGV[1]) then
  return 0
end
redis.call('HSET', KEYS[1], '', ARGV[1])
return redis.call('EXPIRE', KEYS[1], ARGV[2])
`;

// SPDX-License-Identifier: FSL-1.1-MIT

export const SET_CACHE_IF_FRESH_SCRIPT = `
local marker = redis.call('HGET', KEYS[2], '')
if marker and marker ~= '' then
  local invalidationTime = tonumber(marker)
  if not invalidationTime or invalidationTime % 1 ~= 0 or invalidationTime >= tonumber(ARGV[4]) then
    return 0
  end
end

redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3], 'NX')
return 1
`;

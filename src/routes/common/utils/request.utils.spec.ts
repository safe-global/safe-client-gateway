// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Request } from 'express';
import { getClientIp } from '@/routes/common/utils/request.utils';

function buildRequest(
  overrides: Partial<{
    forwardedFor: string;
    ip: string;
    socketAddress: string;
  }> = {},
): Partial<Request> {
  const headers: Record<string, string | undefined> = {};
  if (overrides.forwardedFor !== undefined) {
    headers['x-forwarded-for'] = overrides.forwardedFor;
  }

  return {
    headers,
    ip: overrides.ip,
    socket: { remoteAddress: overrides.socketAddress },
  } as Partial<Request>;
}

describe('getClientIp', () => {
  it('should return the first IP from x-forwarded-for when present', () => {
    const clientIp = faker.internet.ipv4();
    const proxyIp = faker.internet.ipv4();

    const result = getClientIp(
      buildRequest({ forwardedFor: `${clientIp}, ${proxyIp}` }),
    );

    expect(result).toBe(clientIp);
  });

  it('should trim whitespace from the x-forwarded-for value', () => {
    const clientIp = faker.internet.ipv4();

    const result = getClientIp(
      buildRequest({
        forwardedFor: `  ${clientIp}  , ${faker.internet.ipv4()}`,
      }),
    );

    expect(result).toBe(clientIp);
  });

  it('should fall back to request.ip when x-forwarded-for is absent', () => {
    const ip = faker.internet.ipv4();

    const result = getClientIp(buildRequest({ ip }));

    expect(result).toBe(ip);
  });

  it('should fall back to socket.remoteAddress when both x-forwarded-for and ip are absent', () => {
    const socketAddress = faker.internet.ipv4();

    const result = getClientIp(buildRequest({ socketAddress }));

    expect(result).toBe(socketAddress);
  });

  it('should return undefined when no IP source is available', () => {
    const result = getClientIp(buildRequest());

    expect(result).toBeUndefined();
  });

  it('should not throw when headers is undefined', () => {
    const ip = faker.internet.ipv4();
    const request = { ip, socket: {} } as Partial<Request>;

    expect(() => getClientIp(request)).not.toThrow();
    expect(getClientIp(request)).toBe(ip);
  });
});

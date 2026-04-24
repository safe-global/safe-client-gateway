// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { CaptchaService } from '@/routes/captcha/captcha.service';
import { CaptchaGuard } from '@/routes/captcha/guards/captcha.guard';

const mockCaptchaService = jest.mocked({
  verifyToken: jest.fn(),
} as jest.MockedObjectDeep<CaptchaService>);

function buildExecutionContext(
  overrides: Partial<{
    token: string | undefined;
    ip: string;
    forwardedFor: string;
    socketAddress: string;
  }> = {},
): jest.MockedObjectDeep<ExecutionContext> {
  const headers: Record<string, string | undefined> = {};
  if (overrides.token !== undefined) {
    headers['x-captcha-token'] = overrides.token;
  }
  if (overrides.forwardedFor !== undefined) {
    headers['x-forwarded-for'] = overrides.forwardedFor;
  }

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        headers,
        ip: overrides.ip ?? faker.internet.ipv4(),
        socket: { remoteAddress: overrides.socketAddress },
      }),
    }),
  } as jest.MockedObjectDeep<ExecutionContext>;
}

describe('CaptchaGuard', () => {
  let guard: CaptchaGuard;
  let fakeConfigurationService: FakeConfigurationService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('when CAPTCHA is disabled', () => {
    beforeEach(() => {
      fakeConfigurationService = new FakeConfigurationService();
      fakeConfigurationService.set('captcha.enabled', false);
      guard = new CaptchaGuard(mockCaptchaService, fakeConfigurationService);
    });

    it('should allow the request without verifying the token', async () => {
      const result = await guard.canActivate(buildExecutionContext());

      expect(result).toBe(true);
      expect(mockCaptchaService.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('when CAPTCHA is enabled', () => {
    beforeEach(() => {
      fakeConfigurationService = new FakeConfigurationService();
      fakeConfigurationService.set('captcha.enabled', true);
      guard = new CaptchaGuard(mockCaptchaService, fakeConfigurationService);
    });

    it('should throw UnauthorizedException when token header is missing', async () => {
      await expect(
        guard.canActivate(buildExecutionContext({ token: undefined })),
      ).rejects.toThrow(new UnauthorizedException('CAPTCHA token is required'));

      expect(mockCaptchaService.verifyToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      const token = faker.string.alphanumeric();
      mockCaptchaService.verifyToken.mockResolvedValueOnce(false);

      await expect(
        guard.canActivate(buildExecutionContext({ token })),
      ).rejects.toThrow(new UnauthorizedException('Invalid CAPTCHA token'));
    });

    it('should return true for a valid token', async () => {
      const token = faker.string.alphanumeric();
      mockCaptchaService.verifyToken.mockResolvedValueOnce(true);

      const result = await guard.canActivate(buildExecutionContext({ token }));

      expect(result).toBe(true);
    });

    it('should pass request.ip as remoteip when x-forwarded-for is absent', async () => {
      const token = faker.string.alphanumeric();
      const ip = faker.internet.ipv4();
      mockCaptchaService.verifyToken.mockResolvedValueOnce(true);

      await guard.canActivate(buildExecutionContext({ token, ip }));

      expect(mockCaptchaService.verifyToken).toHaveBeenCalledWith(token, ip);
    });

    it('should prefer x-forwarded-for over request.ip', async () => {
      const token = faker.string.alphanumeric();
      const clientIp = faker.internet.ipv4();
      const proxyIp = faker.internet.ipv4();
      mockCaptchaService.verifyToken.mockResolvedValueOnce(true);

      await guard.canActivate(
        buildExecutionContext({
          token,
          ip: proxyIp,
          forwardedFor: `${clientIp}, ${proxyIp}`,
        }),
      );

      expect(mockCaptchaService.verifyToken).toHaveBeenCalledWith(
        token,
        clientIp,
      );
    });
  });
});

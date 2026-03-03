// SPDX-License-Identifier: FSL-1.1-MIT
import { CaptchaService } from '@/routes/captcha/captcha.service';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';

const mockNetworkService = jest.mocked({
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = jest.mocked({
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('CaptchaService', () => {
  let service: CaptchaService;
  let fakeConfigurationService: FakeConfigurationService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('when CAPTCHA is disabled', () => {
    beforeEach(() => {
      fakeConfigurationService = new FakeConfigurationService();
      fakeConfigurationService.set('captcha.enabled', false);

      service = new CaptchaService(
        fakeConfigurationService,
        mockNetworkService,
        mockLoggingService,
      );
    });

    it('should return true without calling the network service', async () => {
      const result = await service.verifyToken(faker.string.alphanumeric());

      expect(result).toBe(true);
      expect(mockNetworkService.post).not.toHaveBeenCalled();
    });
  });

  describe('when CAPTCHA is enabled', () => {
    beforeEach(() => {});

    describe('with no secret key configured', () => {
      it('should throw an error when the secret key is not configured', () => {
        fakeConfigurationService = new FakeConfigurationService();
        fakeConfigurationService.set('captcha.enabled', true);

        expect(() => {
          service = new CaptchaService(
            fakeConfigurationService,
            mockNetworkService,
            mockLoggingService,
          );
        }).toThrow('CAPTCHA is enabled but secret key is not configured');
      });
    });

    describe('with secret key configured', () => {
      const secretKey = faker.string.alphanumeric(32);

      beforeEach(() => {
        fakeConfigurationService = new FakeConfigurationService();
        fakeConfigurationService.set('captcha.enabled', true);
        fakeConfigurationService.set('captcha.secretKey', secretKey);

        service = new CaptchaService(
          fakeConfigurationService,
          mockNetworkService,
          mockLoggingService,
        );
      });

      it('should return true for a valid token', async () => {
        const token = faker.string.alphanumeric();
        mockNetworkService.post.mockResolvedValueOnce({
          status: 200,
          data: rawify({ success: true }),
        });

        const result = await service.verifyToken(token);

        expect(result).toBe(true);
        expect(mockNetworkService.post).toHaveBeenCalledWith({
          url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          data: { secret: secretKey, response: token },
        });
      });

      it('should include remoteip when provided', async () => {
        const token = faker.string.alphanumeric();
        const remoteip = faker.internet.ipv4();
        mockNetworkService.post.mockResolvedValueOnce({
          status: 200,
          data: rawify({ success: true }),
        });

        await service.verifyToken(token, remoteip);

        expect(mockNetworkService.post).toHaveBeenCalledWith({
          url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          data: { secret: secretKey, response: token, remoteip },
        });
      });

      it('should not include remoteip when not provided', async () => {
        const token = faker.string.alphanumeric();
        mockNetworkService.post.mockResolvedValueOnce({
          status: 200,
          data: rawify({ success: true }),
        });

        await service.verifyToken(token);

        expect(mockNetworkService.post).toHaveBeenCalledWith({
          url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          data: { secret: secretKey, response: token },
        });
        expect(
          (
            mockNetworkService.post.mock.calls[0][0].data as Record<
              string,
              unknown
            >
          ).remoteip,
        ).toBeUndefined();
      });

      it('should return false and debug-log error codes for a failed token', async () => {
        const errorCodes = ['invalid-input-response', 'timeout-or-duplicate'];
        mockNetworkService.post.mockResolvedValueOnce({
          status: 200,
          data: rawify({ success: false, 'error-codes': errorCodes }),
        });

        const result = await service.verifyToken(faker.string.alphanumeric());

        expect(result).toBe(false);
        expect(mockLoggingService.debug).toHaveBeenCalledWith({
          type: 'captcha_verification_failed',
          errorCodes,
        });
      });

      it('should return false and debug-log with empty error codes when none returned', async () => {
        mockNetworkService.post.mockResolvedValueOnce({
          status: 200,
          data: rawify({ success: false }),
        });

        const result = await service.verifyToken(faker.string.alphanumeric());

        expect(result).toBe(false);
        expect(mockLoggingService.debug).toHaveBeenCalledWith({
          type: 'captcha_verification_failed',
          errorCodes: [],
        });
      });

      it('should return false and error-log when the network call throws', async () => {
        const networkError = new Error('Network timeout');
        mockNetworkService.post.mockRejectedValueOnce(networkError);

        const result = await service.verifyToken(faker.string.alphanumeric());

        expect(result).toBe(false);
        expect(mockLoggingService.error).toHaveBeenCalledWith({
          type: 'captcha_verification_error',
          error: networkError.message,
        });
      });

      it('should return false and error-log a string error', async () => {
        mockNetworkService.post.mockRejectedValueOnce('string error');

        const result = await service.verifyToken(faker.string.alphanumeric());

        expect(result).toBe(false);
        expect(mockLoggingService.error).toHaveBeenCalledWith({
          type: 'captcha_verification_error',
          error: 'string error',
        });
      });

      it('should return false when the Cloudflare response fails Zod validation', async () => {
        mockNetworkService.post.mockResolvedValueOnce({
          status: 200,
          data: rawify({ unexpected: 'shape' }), // missing required `success` field
        });

        const result = await service.verifyToken(faker.string.alphanumeric());

        expect(result).toBe(false);
        expect(mockLoggingService.error).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'captcha_verification_error' }),
        );
      });
    });
  });
});

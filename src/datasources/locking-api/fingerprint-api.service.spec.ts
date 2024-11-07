import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FingerprintApiService } from '@/datasources/locking-api/fingerprint-api.service';
import { eligibilityRequestBuilder } from '@/domain/community/entities/__tests__/eligibility-request.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { unsealEventsResponse } from '@fingerprintjs/fingerprintjs-pro-server-api';

jest.mock('@fingerprintjs/fingerprintjs-pro-server-api');

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('FingerprintApiService', () => {
  let service: FingerprintApiService;
  let fakeConfigurationService: FakeConfigurationService;
  const eligibilityEncryptionKey = faker.string.uuid();

  beforeEach(() => {
    jest.resetAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'locking.eligibility.fingerprintEncryptionKey',
      eligibilityEncryptionKey,
    );
    fakeConfigurationService.set('locking.eligibility.nonEligibleCountries', [
      'US',
    ]);

    service = new FingerprintApiService(
      fakeConfigurationService,
      mockLoggingService,
    );
  });

  describe('checkEligibility', () => {
    it('should return isAllowed:true and isVpn:false for a non-VPN non-US location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = {
        products: {
          ipInfo: {
            data: {
              v4: {
                geolocation: {
                  country: { code: faker.location.countryCode() },
                },
              },
            },
          },
          locationSpoofing: { data: { result: false } },
          vpn: { data: { result: false } },
        },
      };
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(unsealEventsResponse).toHaveBeenCalledWith(
        Buffer.from(eligibilityRequest.sealedData, 'base64'),
        [
          {
            key: Buffer.from(eligibilityEncryptionKey, 'base64'),
            algorithm: 'aes-256-gcm',
          },
        ],
      );
      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: true,
        isVpn: false,
      });
    });

    it('should return isAllowed:false and isVpn:false for a non-VPN US location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = {
        products: {
          ipInfo: {
            data: { v4: { geolocation: { country: { code: 'US' } } } },
          },
          locationSpoofing: { data: { result: false } },
          vpn: { data: { result: false } },
        },
      };
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(unsealEventsResponse).toHaveBeenCalledWith(
        Buffer.from(eligibilityRequest.sealedData, 'base64'),
        [
          {
            key: Buffer.from(eligibilityEncryptionKey, 'base64'),
            algorithm: 'aes-256-gcm',
          },
        ],
      );
      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: false,
      });
    });

    it('should return isAllowed:false and isVpn:true for a VPN US location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = {
        products: {
          ipInfo: {
            data: { v4: { geolocation: { country: { code: 'US' } } } },
          },
          locationSpoofing: { data: { result: false } },
          vpn: { data: { result: true } },
        },
      };
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(unsealEventsResponse).toHaveBeenCalledWith(
        Buffer.from(eligibilityRequest.sealedData, 'base64'),
        [
          {
            key: Buffer.from(eligibilityEncryptionKey, 'base64'),
            algorithm: 'aes-256-gcm',
          },
        ],
      );
      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: true,
      });
    });

    it('should return isAllowed:true and isVpn:true for a VPN unknown location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = {
        products: {
          ipInfo: null,
          locationSpoofing: { data: { result: false } },
          vpn: { data: { result: true } },
        },
      };
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(unsealEventsResponse).toHaveBeenCalledWith(
        Buffer.from(eligibilityRequest.sealedData, 'base64'),
        [
          {
            key: Buffer.from(eligibilityEncryptionKey, 'base64'),
            algorithm: 'aes-256-gcm',
          },
        ],
      );
      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: true,
        isVpn: true,
      });
    });

    it('should return isAllowed:true and isVpn:false for a unknown location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = {
        products: {
          ipInfo: null,
          locationSpoofing: { data: { result: false } },
          vpn: null,
        },
      };
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(unsealEventsResponse).toHaveBeenCalledWith(
        Buffer.from(eligibilityRequest.sealedData, 'base64'),
        [
          {
            key: Buffer.from(eligibilityEncryptionKey, 'base64'),
            algorithm: 'aes-256-gcm',
          },
        ],
      );
      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: true,
        isVpn: false,
      });
    });

    it('should return isAllowed:false and isVpn:false when location spoofing is detected', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = {
        products: {
          ipInfo: {
            data: {
              v4: {
                geolocation: {
                  country: { code: faker.location.countryCode() },
                },
              },
            },
          },
          locationSpoofing: { data: { result: true } },
          vpn: { data: { result: false } },
        },
      };
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(unsealEventsResponse).toHaveBeenCalledWith(
        Buffer.from(eligibilityRequest.sealedData, 'base64'),
        [
          {
            key: Buffer.from(eligibilityEncryptionKey, 'base64'),
            algorithm: 'aes-256-gcm',
          },
        ],
      );
      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: false,
      });
    });
  });
});

import { fakeJson } from '@/__tests__/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JwtClient } from '@/datasources/jwt/jwt.module';
import { JwtService } from '@/datasources/jwt/jwt.service';
import { faker } from '@faker-js/faker';

const jwtClientMock: jest.MockedObjectDeep<JwtClient> = jest.mocked({
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
});

describe('JwtService', () => {
  let service: JwtService;
  let configIssuer: string;
  let configSecret: string;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();

    configIssuer = faker.word.noun();
    configSecret = faker.string.alphanumeric();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('jwt.issuer', configIssuer);
    fakeConfigurationService.set('jwt.secret', configSecret);

    service = new JwtService(jwtClientMock, fakeConfigurationService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sign', () => {
    it('should sign a payload with default issuer/secret', () => {
      const payload = JSON.parse(fakeJson()) as object;

      service.sign(payload);

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(
        { iss: configIssuer, ...payload },
        {
          secretOrPrivateKey: configSecret,
        },
      );
    });

    it('should sign a payload with custom issuer/secret', () => {
      const customIssuer = faker.word.noun();
      const customSecret = faker.string.alphanumeric();
      const payload = {
        ...(JSON.parse(fakeJson()) as object),
        iss: customIssuer,
      };

      service.sign(payload, {
        secretOrPrivateKey: customSecret,
      });

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(payload, {
        secretOrPrivateKey: customSecret,
      });
    });
  });

  describe('verify', () => {
    it('should verify a token with the default issuer/secret', () => {
      const token = faker.string.alphanumeric();

      service.verify(token);

      expect(jwtClientMock.verify).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.verify).toHaveBeenCalledWith(token, {
        issuer: configIssuer,
        secretOrPrivateKey: configSecret,
      });
    });

    it('should verify a token with custom issuer/secret', () => {
      const token = faker.string.alphanumeric();
      const customIssuer = faker.word.noun();
      const customSecret = faker.string.alphanumeric();

      service.verify(token, {
        issuer: customIssuer,
        secretOrPrivateKey: customSecret,
      });

      expect(jwtClientMock.verify).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.verify).toHaveBeenCalledWith(token, {
        issuer: customIssuer,
        secretOrPrivateKey: customSecret,
      });
    });
  });

  describe('decode', () => {
    it('should decode a token with the default issuer/secret', () => {
      const token = faker.string.alphanumeric();

      service.decode(token);

      expect(jwtClientMock.decode).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.decode).toHaveBeenCalledWith(token, {
        issuer: configIssuer,
        secretOrPrivateKey: configSecret,
      });
    });

    it('should decode a token with custom issuer/secret', () => {
      const token = faker.string.alphanumeric();
      const customIssuer = faker.word.noun();
      const customSecret = faker.string.alphanumeric();

      service.decode(token, {
        issuer: customIssuer,
        secretOrPrivateKey: customSecret,
      });

      expect(jwtClientMock.decode).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.decode).toHaveBeenCalledWith(token, {
        issuer: customIssuer,
        secretOrPrivateKey: customSecret,
      });
    });
  });
});

import { fakeJson } from '@/__tests__/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JwtClient } from '@/datasources/jwt/jwt.module';
import { JwtService } from '@/datasources/jwt/jwt.service';
import { faker } from '@faker-js/faker';

const jwtClientMock: jest.MockedObjectDeep<JwtClient> = jest.mocked({
  sign: jest.fn(),
  verify: jest.fn(),
});

describe('JwtService', () => {
  let service: JwtService;
  let fakeConfigurationService: FakeConfigurationService;

  let jwtIssuer: string;
  let jwtSecret: string;

  beforeEach(() => {
    jest.resetAllMocks();

    jwtIssuer = faker.lorem.word();
    jwtSecret = faker.string.alphanumeric();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('jwt.issuer', jwtIssuer);
    fakeConfigurationService.set('jwt.secret', jwtSecret);

    service = new JwtService(jwtClientMock, fakeConfigurationService);
  });

  describe('sign', () => {
    it('should sign a payload with the issuer', () => {
      const payload = JSON.parse(fakeJson()) as object;

      service.sign(payload);

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(payload, jwtSecret, {
        issuer: jwtIssuer,
      });
    });

    it('should sign a payload with options and the issuer', () => {
      const payload = JSON.parse(fakeJson()) as object;
      const options = {
        expiresIn: faker.number.int({ min: 1 }),
        notBefore: faker.number.int({ min: 1 }),
      };

      service.sign(payload, options);

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(payload, jwtSecret, {
        ...options,
        issuer: jwtIssuer,
      });
    });
  });

  describe('verify', () => {
    it('should verify a token with the issuer and explicit return of payload', () => {
      const token = faker.string.alphanumeric();

      service.verify(token);

      expect(jwtClientMock.verify).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.verify).toHaveBeenCalledWith(token, jwtSecret, {
        issuer: jwtIssuer,
        complete: false,
      });
    });
  });

  describe('decode', () => {
    it('should decode a token with the issuer and return the payload with claims', () => {
      jwtClientMock.verify.mockImplementation(() => ({
        payload: {},
      }));
      const token = faker.string.alphanumeric();

      service.decode(token);

      expect(jwtClientMock.verify).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.verify).toHaveBeenCalledWith(token, jwtSecret, {
        issuer: jwtIssuer,
        complete: true,
      });
    });
  });
});

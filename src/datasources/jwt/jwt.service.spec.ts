import { fakeJson } from '@/__tests__/faker';
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

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();

    service = new JwtService(jwtClientMock);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sign', () => {
    it('should sign a payload without options', () => {
      const payload = JSON.parse(fakeJson()) as object;

      service.sign(payload);

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(payload, {});
    });

    it('should sign a payload with options', () => {
      const payload = JSON.parse(fakeJson()) as object;
      const options = {
        issuedAt: faker.number.int({ min: 1 }),
        expiresIn: faker.number.int({ min: 1 }),
        notBefore: faker.number.int({ min: 1 }),
      };

      service.sign(payload, options);

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(payload, options);
    });
  });

  describe('verify', () => {
    it('should verify a token', () => {
      const token = faker.string.alphanumeric();

      service.verify(token);

      expect(jwtClientMock.verify).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.verify).toHaveBeenCalledWith(token);
    });
  });

  describe('decode', () => {
    it('should decode a token', () => {
      const token = faker.string.alphanumeric();

      service.decode(token);

      expect(jwtClientMock.decode).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.decode).toHaveBeenCalledWith(token);
    });
  });
});

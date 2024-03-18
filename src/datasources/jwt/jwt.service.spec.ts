import { JwtService } from '@/datasources/jwt/jwt.service';

const jwtClient = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

const jwtClientMock = jest.mocked(jwtClient);

describe('JwtService', () => {
  let target: JwtService;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new JwtService(jwtClientMock);
  });

  describe('sign', () => {
    it('should sign a payload', () => {
      const payload = 'payload';
      const options = {
        expiresIn: 60,
        notBefore: 60,
      };

      target.sign(payload, options);

      expect(jwtClientMock.sign).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.sign).toHaveBeenCalledWith(payload, options);
    });
  });

  describe('verify', () => {
    it('should verify a token', () => {
      const token = 'token';

      target.verify(token);

      expect(jwtClientMock.verify).toHaveBeenCalledTimes(1);
      expect(jwtClientMock.verify).toHaveBeenCalledWith(token);
    });
  });
});

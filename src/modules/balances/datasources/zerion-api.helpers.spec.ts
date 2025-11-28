import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';

describe('getZerionHeaders', () => {
  describe('when isTestnet is false (mainnet)', () => {
    it('should return only Authorization header', () => {
      const apiKey = 'test-api-key';

      const result = getZerionHeaders(apiKey, false);

      expect(result).toStrictEqual({
        Authorization: 'Basic test-api-key',
      });
    });

    it('should not include X-Env header', () => {
      const apiKey = 'test-api-key';

      const result = getZerionHeaders(apiKey, false);

      expect(result['X-Env']).toBeUndefined();
    });
  });

  describe('when isTestnet is true', () => {
    it('should return Authorization and X-Env headers', () => {
      const apiKey = 'test-api-key';

      const result = getZerionHeaders(apiKey, true);

      expect(result).toStrictEqual({
        Authorization: 'Basic test-api-key',
        'X-Env': 'testnet',
      });
    });

    it('should set X-Env to testnet', () => {
      const apiKey = 'test-api-key';

      const result = getZerionHeaders(apiKey, true);

      expect(result['X-Env']).toBe('testnet');
    });
  });

  describe('when apiKey is undefined', () => {
    it('should set Authorization header with undefined value for mainnet', () => {
      const result = getZerionHeaders(undefined, false);

      expect(result).toStrictEqual({
        Authorization: 'Basic undefined',
      });
    });

    it('should set Authorization header with undefined value for testnet', () => {
      const result = getZerionHeaders(undefined, true);

      expect(result).toStrictEqual({
        Authorization: 'Basic undefined',
        'X-Env': 'testnet',
      });
    });
  });
});

import {
  getZerionHeaders,
  normalizeZerionBalances,
} from '@/modules/balances/datasources/zerion-api.helpers';
import {
  zerionAttributesBuilder,
  zerionBalanceBuilder,
  zerionChangesBuilder,
} from '@/modules/balances/datasources/entities/__tests__/zerion-balance.entity.builder';

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

  describe('normalizeZerionBalances', () => {
    it('should negate fiat value for loan positions', () => {
      const loanBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: 1000.5,
        })
        .build();

      const result = normalizeZerionBalances([loanBalance]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.value).toBe(-1000.5);
      expect(result[0].attributes.position_type).toBe('loan');
    });

    it('should not modify non-loan positions', () => {
      const depositBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'deposit',
          value: 2000.75,
        })
        .build();

      const result = normalizeZerionBalances([depositBalance]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.value).toBe(2000.75);
      expect(result[0].attributes.position_type).toBe('deposit');
    });

    it('should not modify loan positions with null value', () => {
      const loanBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: null,
        })
        .build();

      const result = normalizeZerionBalances([loanBalance]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.value).toBeNull();
      expect(result[0]).toBe(loanBalance);
    });

    it('should handle mixed array of loans and non-loans', () => {
      const loanBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: 500.25,
        })
        .build();
      const depositBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'deposit',
          value: 1000.5,
        })
        .build();
      const stakedBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'staked',
          value: 750.75,
        })
        .build();

      const result = normalizeZerionBalances([
        loanBalance,
        depositBalance,
        stakedBalance,
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].attributes.value).toBe(-500.25);
      expect(result[0].attributes.position_type).toBe('loan');
      expect(result[1].attributes.value).toBe(1000.5);
      expect(result[1].attributes.position_type).toBe('deposit');
      expect(result[2].attributes.value).toBe(750.75);
      expect(result[2].attributes.position_type).toBe('staked');
    });

    it('should not mutate original balance objects', () => {
      const loanBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: 1000,
        })
        .build();
      const originalValue = loanBalance.attributes.value;

      normalizeZerionBalances([loanBalance]);

      expect(loanBalance.attributes.value).toBe(originalValue);
    });

    it('should preserve all other fields when negating loan value', () => {
      const loanBalance = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: 1000,
          price: 500,
          changes: zerionChangesBuilder()
            .with('absolute_1d', 10)
            .with('percent_1d', 1.5)
            .build(),
        })
        .build();

      const result = normalizeZerionBalances([loanBalance]);

      expect(result[0].attributes.value).toBe(-1000);
      expect(result[0].attributes.price).toBe(500);
      expect(result[0].attributes.changes?.absolute_1d).toBe(10);
      expect(result[0].attributes.changes?.percent_1d).toBe(1.5);
      expect(result[0].id).toBe(loanBalance.id);
      expect(result[0].type).toBe(loanBalance.type);
    });

    it('should handle empty array', () => {
      const result = normalizeZerionBalances([]);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple loans', () => {
      const loan1 = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: 1000,
        })
        .build();
      const loan2 = zerionBalanceBuilder()
        .with('attributes', {
          ...zerionAttributesBuilder().build(),
          position_type: 'loan',
          value: 2000,
        })
        .build();

      const result = normalizeZerionBalances([loan1, loan2]);

      expect(result[0].attributes.value).toBe(-1000);
      expect(result[1].attributes.value).toBe(-2000);
    });
  });
});

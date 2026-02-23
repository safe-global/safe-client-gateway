// SPDX-License-Identifier: FSL-1.1-MIT
import {
  AuthType,
  AuthSchema,
} from '@/modules/auth/domain/entities/auth.entity';
import { authBuilder } from '@/modules/auth/datasources/entities/__tests__/auth.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { omit } from 'lodash';

describe('Auth entity', () => {
  describe('AuthSchema', () => {
    it('should parse a valid Auth', () => {
      const auth = authBuilder().build();

      const result = AuthSchema.safeParse(auth);

      expect(result.success).toBe(true);
      expect(result.success && result.data).toStrictEqual(auth);
    });

    it('should parse with type GOOGLE', () => {
      const auth = authBuilder().with('type', 'GOOGLE').build();

      const result = AuthSchema.safeParse(auth);

      expect(result.success).toBe(true);
      expect(result.success && result.data.type).toBe('GOOGLE');
    });

    it('should not allow invalid type string', () => {
      const auth = authBuilder().build();
      const invalidAuth = { ...auth, type: 'INVALID_PROVIDER' };

      const result = AuthSchema.safeParse(invalidAuth);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        'type',
      ]);
    });

    it('should not allow numeric type (raw DB value)', () => {
      const auth = authBuilder().build();
      const invalidAuth = { ...auth, type: AuthType.GOOGLE };

      const result = AuthSchema.safeParse(invalidAuth);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        'type',
      ]);
    });

    it('should require extUserId', () => {
      const auth = authBuilder().build();

      const result = AuthSchema.safeParse(omit(auth, 'extUserId'));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['extUserId'],
        },
      ]);
    });

    it('should require id', () => {
      const auth = authBuilder().build();

      const result = AuthSchema.safeParse(omit(auth, 'id'));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input: expected number, received undefined',
          path: ['id'],
        },
      ]);
    });

    it('should require user', () => {
      const auth = authBuilder().build();

      const result = AuthSchema.safeParse(omit(auth, 'user'));

      expect(result.success).toBe(false);
    });

    it('should require createdAt', () => {
      const auth = authBuilder().build();

      const result = AuthSchema.safeParse(omit(auth, 'createdAt'));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received undefined',
          path: ['createdAt'],
        },
      ]);
    });

    it('should require updatedAt', () => {
      const auth = authBuilder().build();

      const result = AuthSchema.safeParse(omit(auth, 'updatedAt'));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received undefined',
          path: ['updatedAt'],
        },
      ]);
    });

    it('should validate user object with required properties', () => {
      const user = userBuilder().build();
      const auth = authBuilder().with('user', user).build();

      const result = AuthSchema.safeParse(auth);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.id).toBe(user.id);
        expect(result.data.user.status).toBe(user.status);
        expect(result.data.user.wallets).toStrictEqual(user.wallets);
        expect(result.data.user.members).toStrictEqual(user.members);
        expect(result.data.user.auths).toStrictEqual(user.auths);
        expect(result.data.user.createdAt).toStrictEqual(user.createdAt);
        expect(result.data.user.updatedAt).toStrictEqual(user.updatedAt);
      }
    });

    it.each([
      ['invalid object', { invalid: 'user' }],
      ['null', null],
      ['undefined', undefined],
    ])('should reject %s user', (_, invalidUser) => {
      const auth = authBuilder().build();
      const invalidAuth = { ...auth, user: invalidUser };

      const result = AuthSchema.safeParse(invalidAuth);

      expect(result.success).toBe(false);
    });

    it.each([
      ['empty string', ''],
      ['non-string (number)', 12345],
      ['null', null],
      ['exceeding 255 characters', 'a'.repeat(256)],
    ])('should reject %s extUserId', (_, invalidExtUserId) => {
      const auth = authBuilder().build();
      const invalidAuth = { ...auth, extUserId: invalidExtUserId };

      const result = AuthSchema.safeParse(invalidAuth);

      expect(result.success).toBe(false);
      if (!result.success && typeof invalidExtUserId !== 'object') {
        expect(result.error.issues[0].path).toStrictEqual(['extUserId']);
      }
    });

    it('should allow extUserId up to 255 characters', () => {
      const maxLengthExtUserId = 'a'.repeat(255);
      const auth = authBuilder().with('extUserId', maxLengthExtUserId).build();

      const result = AuthSchema.safeParse(auth);

      expect(result.success).toBe(true);
      expect(result.success && result.data.extUserId).toBe(maxLengthExtUserId);
    });
  });

  describe('AuthType enum', () => {
    it('should have GOOGLE as value 1', () => {
      expect(AuthType.GOOGLE).toBe(1);
    });

    it('should have correct enum keys', () => {
      const keys = getStringEnumKeys(AuthType);

      expect(keys).toStrictEqual(['GOOGLE']);
    });
  });
});

// SPDX-License-Identifier: FSL-1.1-MIT
import {
  OauthType,
  OauthSchema,
} from '@/modules/auth/domain/entities/oauth.entity';
import { oauthBuilder } from '@/modules/auth/datasources/entities/__tests__/oauth.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { omit } from 'lodash';

describe('Oauth entity', () => {
  describe('OauthSchema', () => {
    it('should parse a valid Oauth', () => {
      const oauth = oauthBuilder().build();

      const result = OauthSchema.safeParse(oauth);

      expect(result.success).toBe(true);
      expect(result.success && result.data).toStrictEqual(oauth);
    });

    it('should parse with type GOOGLE', () => {
      const oauth = oauthBuilder().with('type', 'GOOGLE').build();

      const result = OauthSchema.safeParse(oauth);

      expect(result.success).toBe(true);
      expect(result.success && result.data.type).toBe('GOOGLE');
    });

    it('should not allow invalid type string', () => {
      const oauth = oauthBuilder().build();
      const invalidOauth = { ...oauth, type: 'INVALID_PROVIDER' };

      const result = OauthSchema.safeParse(invalidOauth);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        'type',
      ]);
    });

    it('should not allow numeric type (raw DB value)', () => {
      const oauth = oauthBuilder().build();
      const invalidOauth = { ...oauth, type: OauthType.GOOGLE };

      const result = OauthSchema.safeParse(invalidOauth);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        'type',
      ]);
    });

    it('should require extUserId', () => {
      const oauth = oauthBuilder().build();

      const result = OauthSchema.safeParse(omit(oauth, 'extUserId'));

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
      const oauth = oauthBuilder().build();

      const result = OauthSchema.safeParse(omit(oauth, 'id'));

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
      const oauth = oauthBuilder().build();

      const result = OauthSchema.safeParse(omit(oauth, 'user'));

      expect(result.success).toBe(false);
    });

    it('should require createdAt', () => {
      const oauth = oauthBuilder().build();

      const result = OauthSchema.safeParse(omit(oauth, 'createdAt'));

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
      const oauth = oauthBuilder().build();

      const result = OauthSchema.safeParse(omit(oauth, 'updatedAt'));

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
      const oauth = oauthBuilder().with('user', user).build();

      const result = OauthSchema.safeParse(oauth);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.id).toBe(user.id);
        expect(result.data.user.status).toBe(user.status);
        expect(result.data.user.wallets).toStrictEqual(user.wallets);
        expect(result.data.user.members).toStrictEqual(user.members);
        expect(result.data.user.oauths).toStrictEqual(user.oauths);
        expect(result.data.user.createdAt).toStrictEqual(user.createdAt);
        expect(result.data.user.updatedAt).toStrictEqual(user.updatedAt);
      }
    });

    it('should reject invalid user object', () => {
      const oauth = oauthBuilder().build();
      const invalidOauth = { ...oauth, user: { invalid: 'user' } };

      const result = OauthSchema.safeParse(invalidOauth);

      expect(result.success).toBe(false);
    });
  });

  describe('OauthType enum', () => {
    it('should have GOOGLE as value 1', () => {
      expect(OauthType.GOOGLE).toBe(1);
    });

    it('should have correct enum keys', () => {
      const keys = getStringEnumKeys(OauthType);

      expect(keys).toStrictEqual(['GOOGLE']);
    });
  });
});

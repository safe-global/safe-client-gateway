import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';
import { faker } from '@faker-js/faker';

describe('JwtClaimsSchema', () => {
  it('should vaidate a valid JwtClaims', () => {
    const validJwtClaims = {
      iss: faker.lorem.word(),
      sub: faker.lorem.word(),
      aud: faker.lorem.word(),
      exp: faker.number.int(),
      nbf: faker.number.int(),
      iat: faker.number.int(),
      jti: faker.string.uuid(),
    };

    const result = JwtClaimsSchema.safeParse(validJwtClaims);

    expect(result.success).toBe(true);
  });

  it('should allow every field to be optional', () => {
    const result = JwtClaimsSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

// SPDX-License-Identifier: FSL-1.1-MIT
import { generateKeyPairSync } from 'node:crypto';
import { JWT_RS_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';

export type Auth0JwksFixture = {
  privateKey: string;
  publicJwk: JsonWebKey;
  kid: string;
};

export function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  return input instanceof Request ? input.url : input.toString();
}

export function getAuth0JwksFixture(): Auth0JwksFixture {
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });

  return {
    privateKey: keyPair.privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString(),
    publicJwk: keyPair.publicKey.export({ format: 'jwk' }),
    kid: faker.string.alphanumeric(12),
  };
}

export function createAuth0JwksResponse(
  publicJwk: JsonWebKey,
  kid: string,
): Response {
  return new Response(
    JSON.stringify({
      keys: [
        {
          ...publicJwk,
          kid,
          alg: JWT_RS_ALGORITHM,
          use: 'sig',
        },
      ],
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

export function mockAuth0Jwks(args: {
  fetchMock: jest.SpiedFunction<typeof fetch>;
  issuer: string;
  publicJwk: JsonWebKey;
  kid: string;
}): void {
  args.fetchMock.mockImplementation((input) => {
    const url = getFetchUrl(input);

    if (url === `${args.issuer}.well-known/jwks.json`) {
      return Promise.resolve(createAuth0JwksResponse(args.publicJwk, args.kid));
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

export function signAuth0Jwt(args: {
  issuer: string;
  audience: string;
  kid: string;
  privateKey: string;
  payload: object;
  noTimestamp?: boolean;
}): string {
  return jwt.sign(args.payload, args.privateKey, {
    algorithm: JWT_RS_ALGORITHM,
    issuer: args.issuer,
    audience: args.audience,
    ...(args.noTimestamp === undefined
      ? {}
      : { noTimestamp: args.noTimestamp }),
    header: { kid: args.kid, alg: JWT_RS_ALGORITHM },
  });
}

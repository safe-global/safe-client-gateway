// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Auth0Dto } from '@/modules/auth/routes/entities/auth0.dto.entity';
import jwt from 'jsonwebtoken';

export function auth0DtoBuilder(): IBuilder<Auth0Dto> {
  return new Builder<Auth0Dto>().with(
    'access_token',
    jwt.sign({ sub: faker.string.uuid() }, faker.string.alphanumeric(32), {
      algorithm: 'HS256',
    }),
  );
}

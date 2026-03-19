// SPDX-License-Identifier: FSL-1.1-MIT
import { JWT_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class Auth0Dto implements z.infer<typeof Auth0DtoSchema> {
  @ApiProperty()
  access_token!: string;
}

export const Auth0DtoSchema = z
  .object({
    access_token: z.jwt({ alg: JWT_ALGORITHM }),
  })
  .strict();

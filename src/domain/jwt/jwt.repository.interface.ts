import { JwtModule } from '@/datasources/jwt/jwt.module';
import { JwtRepository } from '@/domain/jwt/jwt.repository';
import { Module } from '@nestjs/common';
import { z } from 'zod';

export const IJwtRepository = Symbol('IJwtRepository');

export interface IJwtRepository {
  signToken<T extends string | object>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verifyToken<T extends z.ZodTypeAny>(
    accessToken: string,
    schema: T,
  ): z.ZodType<z.infer<T>>;
}

@Module({
  imports: [JwtModule],
  providers: [
    {
      provide: IJwtRepository,
      useClass: JwtRepository,
    },
  ],
  exports: [IJwtRepository],
})
export class JwtRepositoryModule {}

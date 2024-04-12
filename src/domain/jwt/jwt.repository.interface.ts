import { JwtModule } from '@/datasources/jwt/jwt.module';
import { JwtRepository } from '@/domain/jwt/jwt.repository';
import { Module } from '@nestjs/common';
import { JwtAccessTokenPayload } from '@/routes/auth/entities/jwt-access-token.payload.entity';

export const IJwtRepository = Symbol('IJwtRepository');

export interface IJwtRepository {
  signToken<T extends string | object>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verifyToken(accessToken: string): JwtAccessTokenPayload;
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

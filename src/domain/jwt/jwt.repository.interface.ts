import { JwtModule } from '@/datasources/jwt/jwt.module';
import { JwtRepository } from '@/domain/jwt/jwt.repository';
import { Module } from '@nestjs/common';
import { JwtAccessTokenPayload } from '@/domain/auth/entities/jwt-access-token.payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';

export const IJwtRepository = Symbol('IJwtRepository');

export interface IJwtRepository {
  signToken<T extends JwtAccessTokenPayload>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verifyToken(accessToken: string): JwtAccessTokenPayload;

  decodeToken(accessToken: string): JwtPayloadWithClaims<JwtAccessTokenPayload>;
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

import { JwtModule } from '@/datasources/jwt/jwt.module';
import { AuthRepository } from '@/routes/auth/auth.repository';
import { Module } from '@nestjs/common';
import { AuthPayload as AuthPayload } from '@/routes/auth/entities/auth-payload.entity';
import { JwtPayloadWithClaims as AuthPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';

export const IAuthRepository = Symbol('IAuthRepository');

export interface IAuthRepository {
  signToken<T extends AuthPayload>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verifyToken(accessToken: string): AuthPayload;

  decodeToken(accessToken: string): AuthPayloadWithClaims<AuthPayload>;
}

@Module({
  imports: [JwtModule],
  providers: [
    {
      provide: IAuthRepository,
      useClass: AuthRepository,
    },
  ],
  exports: [IAuthRepository],
})
export class AuthRepositoryModule {}

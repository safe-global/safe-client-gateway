import { JwtModule } from '@/datasources/jwt/jwt.module';
import { AuthRepository } from '@/domain/auth/auth.repository';
import { Module } from '@nestjs/common';
import { AuthPayload as AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
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

  isChain(args: {
    chainId: string;
    authPayload: AuthPayload | undefined;
  }): boolean;

  isSigner(args: {
    signerAddress: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): boolean;
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

import { JwtModule } from '@/datasources/jwt/jwt.module';
import { AuthRepository } from '@/domain/auth/auth.repository';
import { Module } from '@nestjs/common';
import { AuthPayloadDto } from '@/domain/auth/entities/auth-payload.entity';
import { JwtPayloadWithClaims as AuthPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';

export const IAuthRepository = Symbol('IAuthRepository');

export interface IAuthRepository {
  signToken<T extends AuthPayloadDto>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verifyToken(accessToken: string): AuthPayloadDto;

  decodeToken(accessToken: string): AuthPayloadWithClaims<AuthPayloadDto>;
}

@Module({
  imports: [JwtModule, SafeRepositoryModule],
  providers: [
    {
      provide: IAuthRepository,
      useClass: AuthRepository,
    },
  ],
  exports: [IAuthRepository],
})
export class AuthRepositoryModule {}

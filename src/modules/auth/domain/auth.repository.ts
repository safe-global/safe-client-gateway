// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  type AuthPayloadDto,
  AuthPayloadDtoSchema,
  AuthPayloadWithClaimsDtoSchema,
} from '@/modules/auth/domain/entities/auth-payload.entity';

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
  ) {}

  signToken<T extends AuthPayloadDto>(
    payload: T,
    options?: {
      exp?: Date;
      nbf?: Date;
      iat?: Date;
    },
  ): string {
    const authPayloadDto = AuthPayloadDtoSchema.parse(payload);
    return this.jwtService.sign({
      ...authPayloadDto,
      exp: options?.exp,
      nbf: options?.nbf,
      iat: options?.iat,
    });
  }

  verifyToken(accessToken: string): AuthPayloadDto {
    const payload = this.jwtService.verify(accessToken);
    return AuthPayloadDtoSchema.parse(payload);
  }

  decodeToken(accessToken: string): JwtPayloadWithClaims<AuthPayloadDto> {
    const decoded = this.jwtService.decode(accessToken);
    return AuthPayloadWithClaimsDtoSchema.parse(decoded);
  }

  decodeTokenWithoutVerification(
    accessToken: string,
  ): JwtPayloadWithClaims<AuthPayloadDto> | null {
    const decoded = this.jwtService.decodeWithoutVerification(accessToken);
    if (!decoded) return null;
    return AuthPayloadWithClaimsDtoSchema.parse(decoded);
  }

  signTotpElevationToken(args: { userId: string; exp: Date }): string {
    return this.jwtService.sign({
      type: TOTP_ELEVATION_TOKEN_TYPE,
      sub: args.userId,
      exp: args.exp,
    });
  }

  verifyTotpElevationToken(token: string): { userId: string } {
    const payload = this.jwtService.verify<{ type?: string; sub?: string }>(
      token,
    );
    if (payload.type !== TOTP_ELEVATION_TOKEN_TYPE || !payload.sub) {
      throw new Error('Invalid TOTP elevation token');
    }
    return { userId: payload.sub };
  }
}

/**
 * Marks a token as a TOTP elevation token rather than a session token, so the
 * two can never be used interchangeably even though they share a signing key.
 */
const TOTP_ELEVATION_TOKEN_TYPE = 'totp_elevation';

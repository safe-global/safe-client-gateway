import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { VerifyAuthMessageDto } from '@/routes/auth/entities/verify-auth-message.dto.entity';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import { IJwtRepository } from '@/domain/jwt/jwt.repository.interface';

@Injectable()
export class AuthService {
  static readonly AUTH_TOKEN_TOKEN_TYPE = 'Bearer';

  constructor(
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
    @Inject(IJwtRepository)
    private readonly jwtRepository: IJwtRepository,
  ) {}

  async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.siweRepository.generateNonce();
  }

  async verify(args: VerifyAuthMessageDto): Promise<{
    accessToken: string;
    tokenType: string;
  }> {
    const isValid = await this.siweRepository.isValidMessage(args);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    return {
      accessToken: this.jwtRepository.signToken(args.message),
      tokenType: AuthService.AUTH_TOKEN_TOKEN_TYPE,
    };
  }
}

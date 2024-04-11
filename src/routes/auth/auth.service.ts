import { Inject, Injectable } from '@nestjs/common';
import { VerifyAuthMessageDto } from '@/routes/auth/entities/verify-auth-message.dto.entity';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';

@Injectable()
export class AuthService {
  static readonly AUTH_TOKEN_TOKEN_TYPE = 'Bearer';

  constructor(
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
  ) {}

  async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.authRepository.generateNonce();
  }

  async verify(args: VerifyAuthMessageDto): Promise<{
    accessToken: string;
    tokenType: string;
    notBefore: number | null;
    expiresIn: number | null;
  }> {
    return await this.authRepository.verifyMessage(args);
  }
}

import { SiweApiModule } from '@/datasources/siwe-api/siwe-api.module';
import { SiweRepository } from '@/domain/siwe/siwe.repository';
import { VerifyAuthMessageDto } from '@/routes/auth/entities/verify-auth-message.dto.entity';
import { Module } from '@nestjs/common';

export const ISiweRepository = Symbol('ISiweRepository');

export interface ISiweRepository {
  generateNonce(): Promise<{ nonce: string }>;

  isValidMessage(args: VerifyAuthMessageDto): Promise<boolean>;
}

@Module({
  imports: [SiweApiModule],
  providers: [
    {
      provide: ISiweRepository,
      useClass: SiweRepository,
    },
  ],
  exports: [ISiweRepository],
})
export class SiweRepositoryModule {}

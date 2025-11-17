import { SiweApiModule } from '@/modules/siwe/datasources/siwe-api.module';
import { SiweRepository } from '@/modules/siwe/domain/siwe.repository';
import { Module } from '@nestjs/common';
import type { SiweMessage } from 'viem/siwe';
import type { Hex } from 'viem';

export const ISiweRepository = Symbol('ISiweRepository');

export interface ISiweRepository {
  generateNonce(): Promise<{ nonce: string }>;

  getValidatedSiweMessage(args: {
    message: string;
    signature: Hex;
  }): Promise<SiweMessage>;
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

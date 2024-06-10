import { SiweApiModule } from '@/datasources/siwe-api/siwe-api.module';
import { BlockchainApiManagerModule } from '@/domain/interfaces/blockchain-api.manager.interface';
import { SiweRepository } from '@/domain/siwe/siwe.repository';
import { Module } from '@nestjs/common';

export const ISiweRepository = Symbol('ISiweRepository');

export interface ISiweRepository {
  generateNonce(): Promise<{ nonce: string }>;

  isValidMessage(args: {
    message: string;
    signature: `0x${string}`;
  }): Promise<boolean>;
}

@Module({
  imports: [SiweApiModule, BlockchainApiManagerModule],
  providers: [
    {
      provide: ISiweRepository,
      useClass: SiweRepository,
    },
  ],
  exports: [ISiweRepository],
})
export class SiweRepositoryModule {}

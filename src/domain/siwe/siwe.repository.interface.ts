import { SiweRepository } from '@/domain/siwe/siwe.repository';
import { Module } from '@nestjs/common';

export const ISiweRepository = Symbol('ISiweRepository');

export interface ISiweRepository {
  generateNonce(): Promise<{ nonce: string }>;

  verifyMessage(args: {
    message: string;
    signature: `0x${string}`;
  }): Promise<boolean>;
}

@Module({
  providers: [
    {
      provide: ISiweRepository,
      useClass: SiweRepository,
    },
  ],
  exports: [ISiweRepository],
})
export class SiweRepositoryModule {}

// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BlockchainDomainModule } from '@/modules/blockchain/domain/blockchain.domain.module';
import { RelayDomainModule } from '@/modules/relay/domain/relay.domain.module';
import { KmsSafenetPayerSigner } from '@/modules/safenet/datasources/kms-safenet-payer-signer';
import { ISafenetPayer } from '@/modules/safenet/domain/interfaces/safenet-payer.interface';
import * as Signer from '@/modules/safenet/domain/interfaces/safenet-payer-signer.interface';
import { SafenetPayer } from '@/modules/safenet/domain/safenet-payer';

@Module({
  imports: [RelayDomainModule, BlockchainDomainModule],
  providers: [
    { provide: Signer.ISafenetPayerSigner, useClass: KmsSafenetPayerSigner },
    { provide: ISafenetPayer, useClass: SafenetPayer },
  ],
  exports: [ISafenetPayer],
})
export class SafenetModule {}

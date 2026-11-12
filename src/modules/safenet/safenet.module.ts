// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BlockchainModule } from '#/modules/blockchain/blockchain.module';
import { RelayDomainModule } from '#/modules/relay/domain/relay.domain.module';
import { KmsSafenetPayerSigner } from '#/modules/safenet/datasources/kms-safenet-payer-signer';
import * as Signer from '#/modules/safenet/domain/interfaces/safenet-payer-signer.interface';
import { SafenetPayer } from '#/modules/safenet/domain/safenet-payer';

@Module({
  imports: [RelayDomainModule, BlockchainModule],
  providers: [
    { provide: Signer.ISafenetPayerSigner, useClass: KmsSafenetPayerSigner },
    SafenetPayer,
  ],
  exports: [SafenetPayer],
})
export class SafenetModule {}

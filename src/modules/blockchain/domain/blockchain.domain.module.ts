// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';

@Module({ imports: [BlockchainModule], exports: [BlockchainModule] })
export class BlockchainDomainModule {}

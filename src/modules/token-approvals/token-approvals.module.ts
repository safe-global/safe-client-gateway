// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BlockchainModule } from '#/modules/blockchain/blockchain.module';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeRepositoryModule } from '#/modules/safe/domain/safe.repository.interface';
import { TokenApprovalCallsHelper } from '#/modules/token-approvals/domain/helpers/token-approval-calls.helper';
import { TokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository';
import { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import { TokenApprovalsRateLimitGuard } from '#/modules/token-approvals/routes/guards/token-approvals-rate-limit.guard';
import { TokenApprovalsController } from '#/modules/token-approvals/routes/token-approvals.controller';
import { TokenApprovalsService } from '#/modules/token-approvals/routes/token-approvals.service';

@Module({
  imports: [SafeRepositoryModule, BlockchainModule],
  providers: [
    {
      provide: ITokenApprovalsRepository,
      useClass: TokenApprovalsRepository,
    },
    MultiSendDecoder,
    TokenApprovalCallsHelper,
    TokenApprovalsRateLimitGuard,
    TokenApprovalsService,
  ],
  controllers: [TokenApprovalsController],
})
export class TokenApprovalsModule {}

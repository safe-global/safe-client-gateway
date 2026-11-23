// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { BlockchainModule } from '#/modules/blockchain/blockchain.module';
import { TokenApprovalsApi } from '#/modules/token-approvals/datasources/token-approvals-api.service';
import { TokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository';
import { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import { TokenApprovalsRateLimitGuard } from '#/modules/token-approvals/routes/guards/token-approvals-rate-limit.guard';
import { TokenApprovalsController } from '#/modules/token-approvals/routes/token-approvals.controller';
import { TokenApprovalsService } from '#/modules/token-approvals/routes/token-approvals.service';
import { TokensModule } from '#/modules/tokens/tokens.module';

@Module({
  imports: [BlockchainModule, TokensModule],
  providers: [
    HttpErrorFactory,
    TokenApprovalsApi,
    {
      provide: ITokenApprovalsRepository,
      useClass: TokenApprovalsRepository,
    },
    TokenApprovalsRateLimitGuard,
    TokenApprovalsService,
  ],
  controllers: [TokenApprovalsController],
})
export class TokenApprovalsModule {}

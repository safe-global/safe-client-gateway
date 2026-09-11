// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { TokenRepository } from '@/modules/tokens/domain/token.repository';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';
import { TokensController } from '@/modules/tokens/routes/tokens.controller';
import { TokensService } from '@/modules/tokens/routes/tokens.service';

@Module({
  imports: [TransactionApiManagerModule],
  controllers: [TokensController],
  providers: [
    {
      provide: ITokenRepository,
      useClass: TokenRepository,
    },
    TokensService,
  ],
  exports: [ITokenRepository],
})
export class TokensModule {}

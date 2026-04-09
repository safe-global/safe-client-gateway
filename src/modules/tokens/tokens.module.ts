// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.module';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';
import { TokenRepository } from '@/modules/tokens/domain/token.repository';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: ITokenRepository,
      useClass: TokenRepository,
    },
  ],
  exports: [ITokenRepository],
})
export class TokensModule {}

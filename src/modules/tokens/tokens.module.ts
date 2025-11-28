import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
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

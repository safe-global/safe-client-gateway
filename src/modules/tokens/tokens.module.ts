import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { TokenRepository } from '@/modules/tokens/domain/token.repository';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';

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

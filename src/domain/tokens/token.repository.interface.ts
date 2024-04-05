import { Page } from '@/domain/entities/page.entity';
import { Token } from '@/domain/tokens/entities/token.entity';
import { Module } from '@nestjs/common';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const ITokenRepository = Symbol('ITokenRepository');

export interface ITokenRepository {
  getToken(args: { chainId: string; address: string }): Promise<Token>;

  getTokens(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Token>>;
}

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
export class TokenRepositoryModule {}

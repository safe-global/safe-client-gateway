import { Page } from '@/domain/entities/page.entity';
import { Token } from '@/modules/tokens/domain/entities/token.entity';
import { Module } from '@nestjs/common';
import { TokenRepository } from '@/modules/tokens/domain/token.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Address } from 'viem';

export const ITokenRepository = Symbol('ITokenRepository');

export interface ITokenRepository {
  getToken(args: { chainId: string; address: Address }): Promise<Token>;

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

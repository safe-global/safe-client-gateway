import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  type Token,
  TokenPageSchema,
  TokenSchema,
} from '@/modules/tokens/domain/entities/token.entity';
import type { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';

@Injectable()
export class TokenRepository implements ITokenRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getToken(args: { chainId: string; address: Address }): Promise<Token> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const token = await transactionService.getToken(args.address);
    return TokenSchema.parse(token);
  }

  async getTokens(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Token>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getTokens(args);
    return TokenPageSchema.parse(page);
  }
}

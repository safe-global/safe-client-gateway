import { Inject, Injectable } from '@nestjs/common';
import { type Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { type Token } from '@/modules/tokens/domain/entities/token.entity';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';
import {
  TokenPageSchema,
  TokenSchema,
} from '@/modules/tokens/domain/entities/token.entity';
import type { Address } from 'viem';

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

import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Token } from '@/domain/tokens/entities/token.entity';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import {
  TokenPageSchema,
  TokenSchema,
} from '@/domain/tokens/entities/schemas/token.schema';

@Injectable()
export class TokenRepository implements ITokenRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getToken(args: { chainId: string; address: string }): Promise<Token> {
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

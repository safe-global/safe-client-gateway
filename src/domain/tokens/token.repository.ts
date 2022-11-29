import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../entities/page.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { Token } from './entities/token.entity';
import { ITokenRepository } from './token.repository.interface';
import { TokenValidator } from './token.validator';

@Injectable()
export class TokenRepository implements ITokenRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly tokenValidator: TokenValidator,
  ) {}

  async getToken(chainId: string, address: string): Promise<Token> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const token = await transactionService.getToken(address);
    return this.tokenValidator.validate(token);
  }

  async getTokens(
    chainId: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Token>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const page = await transactionService.getTokens(limit, offset);

    page.results.map((token) => this.tokenValidator.validate(token));

    return page;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { BackboneValidator } from './backbone.validator';
import { Backbone } from './entities/backbone.entity';

@Injectable()
export class BackboneRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: BackboneValidator,
  ) {}

  async getBackbone(chainId: string): Promise<Backbone> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const data = await api.getBackbone();
    return this.validator.validate(data);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IBackboneRepository } from '@/domain/backbone/backbone.repository.interface';
import { BackboneSchema } from '@/domain/backbone/entities/schemas/backbone.schema';

@Injectable()
export class BackboneRepository implements IBackboneRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getBackbone(chainId: string): Promise<Backbone> {
    const api = await this.transactionApiManager.getApi(chainId);
    const data = await api.getBackbone();
    return BackboneSchema.parse(data);
  }
}

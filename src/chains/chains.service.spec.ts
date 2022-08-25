import { ConfigService } from '../datasources/config-service/config-service.service';
import { TransactionApiManager } from '../datasources/transaction-api/transaction-api.manager';
import { TransactionApi } from '../datasources/transaction-api/transaction-api.service';
import { ChainsService } from './chains.service';
import { Backbone } from './entities';
import backboneFactory from './entities/__tests__/backbone.factory';

const BACKBONE: Backbone = backboneFactory();

describe('ChainsService', () => {
  const configService = {} as unknown as ConfigService;

  const transactionService = {
    getBackbone: jest.fn().mockResolvedValue(BACKBONE),
  } as unknown as TransactionApi;

  const transactionManager = {
    getTransactionService: jest.fn().mockResolvedValue(transactionService),
  } as unknown as TransactionApiManager;

  const service: ChainsService = new ChainsService(
    configService,
    transactionManager,
  );

  it('should retrieve the backbone metadata from the proper TransactionService', async () => {
    const chainId = '1';

    const backbone = await service.getBackbone(chainId);

    expect(backbone).toBe(BACKBONE);
    expect(transactionService.getBackbone).toBeCalledTimes(1);
    expect(transactionManager.getTransactionService).toHaveBeenCalledWith(
      chainId,
    );
  });
});

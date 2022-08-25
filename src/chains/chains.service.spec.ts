import { ConfigApi } from '../datasources/config-api/config-api.service';
import { TransactionApiManager } from '../datasources/transaction-api/transaction-api.manager';
import { TransactionApi } from '../datasources/transaction-api/transaction-api.service';
import { ChainsService } from './chains.service';
import { Backbone } from './entities';
import backboneFactory from './entities/__tests__/backbone.factory';

const BACKBONE: Backbone = backboneFactory();

describe('ChainsService', () => {
  const configApi = {} as unknown as ConfigApi;

  const transactionApi = {
    getBackbone: jest.fn().mockResolvedValue(BACKBONE),
  } as unknown as TransactionApi;

  const transactionApiManager = {
    getTransactionApi: jest.fn().mockResolvedValue(transactionApi),
  } as unknown as TransactionApiManager;

  const service: ChainsService = new ChainsService(
    configApi,
    transactionApiManager,
  );

  it('should retrieve the backbone metadata from the proper TransactionApi', async () => {
    const chainId = '1';

    const backbone = await service.getBackbone(chainId);

    expect(backbone).toBe(BACKBONE);
    expect(transactionApi.getBackbone).toBeCalledTimes(1);
    expect(transactionApiManager.getTransactionApi).toHaveBeenCalledWith(
      chainId,
    );
  });
});

import { ConfigService } from '../services/config-service/config-service.service';
import { TransactionServiceManager } from '../services/transaction-service/transaction-service.manager';
import { TransactionService } from '../services/transaction-service/transaction-service.service';
import { ChainsService } from './chains.service';
import { Backbone } from './entities';

const BACKBONE: Backbone = {
  name: 'testName',
  version: '',
  api_version: '',
  secure: false,
  host: '',
  headers: [],
  settings: undefined,
};

describe('ChainsService', () => {
  const configService = {} as unknown as ConfigService;

  const transactionService = {
    getBackbone: jest.fn().mockResolvedValue(BACKBONE),
  } as unknown as TransactionService;

  const transactionManager = {
    getTransactionService: jest.fn().mockResolvedValue(transactionService),
  } as unknown as TransactionServiceManager;

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

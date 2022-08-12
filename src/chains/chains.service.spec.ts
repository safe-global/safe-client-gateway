import { Test, TestingModule } from '@nestjs/testing';
import { ConfigServiceModule } from '../services/config-service/config-service.module';
import { TransactionServiceModule } from '../services/transaction-service/transaction-service.module';
import { ChainsService } from './chains.service';

describe('ChainsService', () => {
  let service: ChainsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigServiceModule, TransactionServiceModule],
      providers: [ChainsService],
    }).compile();

    service = module.get<ChainsService>(ChainsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: implement actually useful tests
});

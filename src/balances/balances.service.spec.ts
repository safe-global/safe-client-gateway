import { Test, TestingModule } from '@nestjs/testing';
import { SafeTransactionModule } from './../services/safe-transaction/safe-transaction.module';
import { BalancesService } from './balances.service';

describe('BalancesService', () => {
  let service: BalancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SafeTransactionModule],
      providers: [BalancesService],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

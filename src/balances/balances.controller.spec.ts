import { Test, TestingModule } from '@nestjs/testing';
import { SafeTransactionModule } from '../services/safe-transaction/safe-transaction.module';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';

describe('BalancesController', () => {
  let controller: BalancesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SafeTransactionModule],
      controllers: [BalancesController],
      providers: [BalancesService],
    }).compile();

    controller = module.get<BalancesController>(BalancesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

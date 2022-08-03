import { Test, TestingModule } from '@nestjs/testing';
import { SafeConfigModule } from '../services/safe-config/safe-config.module';
import { ChainsController } from './chains.controller';
import { ChainsService } from './chains.service';

describe('ChainsController', () => {
  let controller: ChainsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SafeConfigModule],
      controllers: [ChainsController],
      providers: [ChainsService],
    }).compile();

    controller = module.get<ChainsController>(ChainsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

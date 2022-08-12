import { Test, TestingModule } from '@nestjs/testing';
import { ConfigServiceModule } from '../services/config-service/config-service.module';
import { ChainsController } from './chains.controller';
import { ChainsService } from './chains.service';

describe('ChainsController', () => {
  let controller: ChainsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigServiceModule],
      controllers: [ChainsController],
      providers: [ChainsService],
    }).compile();

    controller = module.get<ChainsController>(ChainsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

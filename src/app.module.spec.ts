import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  // Skipping this test as it tests with the real common modules
  // meaning that networking and local environment should be provided
  it.skip(`AppModule is successfully created`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();
  });
});

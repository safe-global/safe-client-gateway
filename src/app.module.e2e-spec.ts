import { createBaseTestModule } from '@/__tests__/testing-module';

describe('Application bootstrap', () => {
  it('should init the app', async () => {
    const moduleRef = await createBaseTestModule();

    const app = moduleRef.createNestApplication();
    await app.init();
    expect(app).toBeDefined();
    await app.close();
  });
});

// SPDX-License-Identifier: FSL-1.1-MIT
import {
  createTestApplication,
  initTestApplication,
} from '@/__tests__/test-app.provider';
import { createBaseTestModule } from '@/__tests__/testing-module';

describe('Application bootstrap', () => {
  it('should init the app', async () => {
    const moduleRef = await createBaseTestModule();

    const app = createTestApplication(moduleRef);
    await initTestApplication(app);
    expect(app).toBeDefined();
    await app.close();
  });
});

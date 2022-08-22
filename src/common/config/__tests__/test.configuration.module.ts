import { Global, Module } from '@nestjs/common';
import { IConfigurationService } from '../configuration.service.interface';
import { FakeConfigurationService } from './fake.configuration.service';

/**
 * {@link fakeConfigurationService} should be used in a test setup.
 *
 * It provides the ability to set a specific configuration key to any value.
 *
 * {@link fakeConfigurationService} is available only when a module imports
 * {@link TestConfigurationModule}
 */
export const fakeConfigurationService = new FakeConfigurationService();

/**
 * The {@link TestConfigurationModule} should be used whenever you want to
 * override the values provided by {@link NestConfigurationService}
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestConfigurationModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real Configuration Module with a fake one – {@link fakeConfigurationService}
 */
@Global()
@Module({
  providers: [{ provide: IConfigurationService, useValue: fakeConfigurationService }],
  exports: [IConfigurationService],
})
export class TestConfigurationModule {}

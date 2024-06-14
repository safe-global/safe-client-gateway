import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NestConfigurationService } from '@/config/nest.configuration.service';
import { z } from 'zod';
import configurationValidator from '@/config/configuration.validator';

/**
 * A {@link Global} Module which provides local configuration support via {@link IConfigurationService}
 * Feature Modules don't need to import this module directly in order to inject
 * the {@link IConfigurationService}.
 *
 * This module should be included in the "root" application module
 */
@Global()
@Module({})
export class ConfigurationModule {
  static register(configFactory: ConfigFactory): DynamicModule {
    return {
      module: ConfigurationModule,
      imports: [
        ConfigModule.forRoot({
          validate: (config: Record<string, unknown>) => {
            return configurationValidator(config, RootConfigurationSchema);
          },
          load: [configFactory],
        }),
      ],
      providers: [
        { provide: IConfigurationService, useClass: NestConfigurationService },
      ],
      exports: [IConfigurationService],
    };
  }
}

export const RootConfigurationSchema = z.object({
  AUTH_TOKEN: z.string(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .optional(),
  EMAIL_API_APPLICATION_CODE: z.string(),
  EMAIL_API_FROM_EMAIL: z.string().email(),
  EMAIL_API_KEY: z.string(),
  EMAIL_TEMPLATE_RECOVERY_TX: z.string(),
  EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: z.string(),
  EMAIL_TEMPLATE_VERIFICATION_CODE: z.string(),
  INFURA_API_KEY: z.string(),
  RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: z.string(),
  RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: z.string(),
  RELAY_PROVIDER_API_KEY_SEPOLIA: z.string(),
});

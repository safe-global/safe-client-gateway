import { DynamicModule, Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import { ConfigModule } from '@nestjs/config';
import { NestConfigurationService } from '@/config/nest.configuration.service';
import jwtConfiguration from '@/datasources/jwt/configuration/jwt.configuration';

@Module({})
export class JwtConfigurationModule {
  static register(configFactory: ConfigFactory): DynamicModule {
    return {
      module: JwtConfigurationModule,
      imports: [ConfigModule.forFeature(configFactory)],
      providers: [
        { provide: IConfigurationService, useClass: NestConfigurationService },
      ],
      exports: [IConfigurationService],
    };
  }
}

export const JWT_CONFIGURATION_MODULE =
  JwtConfigurationModule.register(jwtConfiguration);

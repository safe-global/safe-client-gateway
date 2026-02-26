// SPDX-License-Identifier: FSL-1.1-MIT
import type { DynamicModule, INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import type { SwaggerDocumentOptions } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import { AppProvider, configureShutdownHooks } from '@/app.provider';

function configureVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
  });
}

function configureSwagger(app: INestApplication): void {
  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );

  const config = new DocumentBuilder()
    .setTitle('Safe Wallet Auth Service')
    .setDescription('Authentication service for Safe Wallet')
    .setVersion(configurationService.get('about.version') ?? '')
    .build();

  const options: SwaggerDocumentOptions = {
    operationIdFactory: (
      controllerKey: string,
      methodKey: string,
      version: string | undefined,
    ) => {
      const capitalize = (str: string): string =>
        str ? str[0].toUpperCase() + str.slice(1) : '';
      const decapitalize = (str: string): string =>
        str ? str[0].toLowerCase() + str.slice(1) : '';
      const versionPart = version ? capitalize(version) : '';
      const controllerPart = decapitalize(
        controllerKey
          .replace('Controller', '')
          .replace(new RegExp(versionPart, 'i'), ''),
      );
      const methodPart = capitalize(methodKey);
      return `${controllerPart}${methodPart}${versionPart}`;
    },
  };

  const document = SwaggerModule.createDocument(app, config, options);
  SwaggerModule.setup('api', app, document, {
    customfavIcon: '/favicon.png',
    customSiteTitle: 'Safe Wallet Auth Service',
    customCss: `.topbar-wrapper img { content:url('logo.svg'); }`,
  });
}

function configureRequestBodyLimit(app: INestApplication): void {
  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );

  const jsonBodySizeLimit =
    configurationService.get<string>('express.jsonLimit');
  if (jsonBodySizeLimit) {
    app.use(json({ limit: jsonBodySizeLimit }));
  }
}

function configureCookies(app: INestApplication): void {
  app.use(cookieParser());
}

export const AUTH_SERVICE_CONFIGURATION: Array<
  (app: INestApplication) => void
> = [
  configureVersioning,
  configureShutdownHooks,
  configureSwagger,
  configureRequestBodyLimit,
  configureCookies,
];

/**
 * Auth Service App Provider
 *
 * Provides the NestJS application configured for the auth service.
 * Uses the same provider pattern as the main gateway but with
 * auth-specific Swagger configuration.
 */
export class AuthAppProvider<T extends DynamicModule> extends AppProvider<T> {
  protected readonly configuration: Array<(app: INestApplication) => void> =
    AUTH_SERVICE_CONFIGURATION;

  protected getApp(module: T): Promise<INestApplication> {
    return NestFactory.create(module);
  }
}

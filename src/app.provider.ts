// SPDX-License-Identifier: FSL-1.1-MIT

import fastifyCookie from '@fastify/cookie';
import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { SwaggerDocumentOptions } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IConfigurationService } from '@/config/configuration.service.interface';

function configureVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
  });
}

const BODY_LIMIT_UNITS = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
} as const;

type BodyLimitUnit = keyof typeof BODY_LIMIT_UNITS;

type FastifyAdapterConfiguration = {
  jsonLimit?: string;
  trustProxy: string;
};

export function parseTrustProxy(value: string): string | number {
  return /^[0-9]+$/.test(value) ? Number.parseInt(value, 10) : value;
}

export function parseBodyLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (/^[0-9]+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid JSON body size limit: ${value}`);
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2] as BodyLimitUnit;
  return Math.floor(amount * BODY_LIMIT_UNITS[unit]);
}

export function createFastifyAdapterFromConfiguration(
  config: FastifyAdapterConfiguration,
): FastifyAdapter {
  const bodyLimit = parseBodyLimit(config.jsonLimit);

  return new FastifyAdapter({
    trustProxy: parseTrustProxy(config.trustProxy),
    ...(bodyLimit === undefined ? {} : { bodyLimit }),
  });
}

export function createFastifyAdapter(
  configurationService: Pick<IConfigurationService, 'get' | 'getOrThrow'>,
): FastifyAdapter {
  return createFastifyAdapterFromConfiguration({
    jsonLimit: configurationService.get<string>('express.jsonLimit'),
    trustProxy: configurationService.getOrThrow<string>('express.trustProxy'),
  });
}

export function configureShutdownHooks(app: INestApplication): void {
  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );
  // Skip shutdown hooks in development to allow fast restarts.
  // In dev mode, the OS reclaims connections when the process exits.
  if (!configurationService.getOrThrow('application.isDevelopment')) {
    app.enableShutdownHooks();
  }
}

function configureSwagger(app: INestApplication): void {
  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );

  const config = new DocumentBuilder()
    .setTitle('Safe Client Gateway')
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
    customSiteTitle: 'Safe Client Gateway',
    customCss: `.topbar-wrapper img { content:url('logo.svg'); }`,
  });
}

async function configureCookies(app: INestApplication): Promise<void> {
  await (app as NestFastifyApplication).register(fastifyCookie);
}

export const DEFAULT_CONFIGURATION: Array<
  (app: INestApplication) => void | Promise<void>
> = [
  configureVersioning,
  configureShutdownHooks,
  configureSwagger,
  configureCookies,
];

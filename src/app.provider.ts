import { INestApplication, VersioningType } from '@nestjs/common';
import { DataSourceErrorFilter } from './routes/common/filters/data-source-error.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { TestingModule } from '@nestjs/testing/testing-module';

function configureVersioning(app: INestApplication) {
  app.enableVersioning({
    type: VersioningType.URI,
  });
}

function configureShutdownHooks(app: INestApplication) {
  app.enableShutdownHooks();
}

function configureFilters(app: INestApplication) {
  app.useGlobalFilters(new DataSourceErrorFilter());
}

function configureSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Safe Client Gateway')
    .setVersion(process.env.npm_package_version ?? '')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document);
}

/**
 * The main goal of {@link AppProvider} is to provide
 * a {@link INestApplication}.
 *
 * Extensions of this class should return the application in
 * {@link getApp}.
 *
 * By default the {@link AppProvider} has a configuration collection ({@link setup})
 * that can be changed by each extension of the class
 */
export abstract class AppProvider {
  protected readonly setup: Array<(app: INestApplication) => void> = [
    configureVersioning,
    configureShutdownHooks,
    configureFilters,
    configureSwagger,
  ];

  public async provide(module: any): Promise<INestApplication> {
    const app = await this.getApp(module);
    this.setup.forEach((f) => f(app));
    return app;
  }

  protected abstract getApp(module: any): Promise<INestApplication>;
}

/**
 * The default {@link AppProvider}
 *
 * This provider should be used to retrieve the actual implementation of the
 * service
 */
export class DefaultAppProvider extends AppProvider {
  protected getApp(module: any): Promise<INestApplication> {
    return NestFactory.create(module);
  }
}

/**
 * A test {@link AppProvider}
 *
 * This provider provides an application given a {@link TestingModule}
 *
 * If the module provided is not a {@link TestingModule}, an error is thrown
 */
export class TestAppProvider extends AppProvider {
  constructor() {
    super();
    if (process.env.NODE_ENV !== 'test') {
      throw Error('TestAppProvider used outside of a testing environment');
    }

    // Disables shutdown hooks for tests (they are not required)
    // Enabling this in the tests might result in a MaxListenersExceededWarning
    // as the number of listeners that this adds exceed the default
    const index = this.setup.indexOf(configureShutdownHooks);
    if (index > -1) this.setup.splice(index, 1);
  }

  protected getApp(module: any): Promise<INestApplication> {
    if (!(module instanceof TestingModule))
      return Promise.reject(
        `${module.constructor.name} is not a TestingModule`,
      );
    return Promise.resolve(module.createNestApplication());
  }
}

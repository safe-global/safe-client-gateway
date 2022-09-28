import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSourceErrorFilter } from './routes/common/filters/data-source-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  app.useGlobalFilters(new DataSourceErrorFilter());

  const config = new DocumentBuilder()
    .setTitle('Safe Client Gateway')
    .setVersion(process.env.npm_package_version ?? '')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document);

  await app.listen(3000);
}

bootstrap();

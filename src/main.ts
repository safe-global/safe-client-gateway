import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DataSourceErrorFilter } from './routes/common/filters/data-source-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  app.useGlobalFilters(new DataSourceErrorFilter());

  const config = new DocumentBuilder()
    .setTitle('Safe Client Gateway')
    .setVersion(configService.get('about.version') ?? '')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document);

  await app.listen(3000);
}

bootstrap();

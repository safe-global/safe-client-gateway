import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { APP_FILTER } from '@nestjs/core';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';
import { z } from 'zod';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { faker } from '@faker-js/faker';

const ZodSchema = z.object({
  value: z.string(),
  secondValue: z.string(),
});

const ZodUnionSchema = z.union([
  ZodSchema,
  z.object({
    secondUnionValue: z.number(),
    secondUnionSecondValue: z.number(),
  }),
]);

const ZodNestedUnionSchema = z.union([
  z.object({ first: ZodUnionSchema }),
  z.object({ second: ZodUnionSchema }),
]);

@Controller({})
class TestController {
  @Post('zod-exception')
  async zodError(
    @Body(new ValidationPipe(ZodSchema)) body: z.infer<typeof ZodSchema>,
  ): Promise<z.infer<typeof ZodSchema>> {
    return body;
  }

  @Post('zod-union-exception')
  async zodUnionError(
    @Body(new ValidationPipe(ZodUnionSchema))
    body: z.infer<typeof ZodUnionSchema>,
  ): Promise<z.infer<typeof ZodUnionSchema>> {
    return body;
  }

  @Post('zod-nested-union-exception')
  async zodNestedUnionError(
    @Body(new ValidationPipe(ZodNestedUnionSchema))
    body: z.infer<typeof ZodNestedUnionSchema>,
  ): Promise<z.infer<typeof ZodNestedUnionSchema>> {
    return body;
  }

  @Get('non-zod-exception')
  async nonZodException(): Promise<void> {
    throw new Error('Some random error');
  }
}

describe('ZodErrorFilter tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: ZodErrorFilter,
        },
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('ZodError exception returns first issue', async () => {
    await request(app.getHttpServer())
      .post('/zod-exception')
      .send({ value: faker.number.int() })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['value'], // Only the first issue is returned
        message: 'Expected string, received number',
      });
  });

  it('ZodError union exception returns first issue of first union issue', async () => {
    await request(app.getHttpServer())
      .post('/zod-union-exception')
      .send({ value: faker.datatype.boolean() })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'boolean',
        path: ['value'], // Only the first union, first issue is returned
        message: 'Expected string, received boolean',
      });
  });

  it('ZodError nested union exception returns first issue of nested union issue', async () => {
    await request(app.getHttpServer())
      .post('/zod-union-exception')
      .send({
        first: {
          secondUnionValue: faker.datatype.boolean(),
        },
      })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['value'], // Only the first union of the nested union error, first issue is returned
        message: 'Required',
      });
  });

  it('non-ZodError exception returns correct error code and message', async () => {
    await request(app.getHttpServer())
      .get('/non-zod-exception')
      .expect(500)
      .expect({
        statusCode: 500,
        message: 'Internal server error',
      });
  });
});

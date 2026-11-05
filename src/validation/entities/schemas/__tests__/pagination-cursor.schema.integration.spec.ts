// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import {
  Controller,
  Get,
  type INestApplication,
  Module,
  Query,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  createTestApplication,
  initTestApplication,
} from '#/__tests__/test-app.provider';
import { ZodErrorFilter } from '#/routes/common/filters/zod-error.filter';
import { PaginationData } from '#/routes/common/pagination/pagination.data';
import { PaginationCursorSchema } from '#/validation/entities/schemas/pagination-cursor.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

describe('PaginationCursorSchema in a ValidationPipe', () => {
  let app: INestApplication<Server>;
  let paginationData: PaginationData | undefined;

  @Controller()
  class TestController {
    @Get()
    route(
      @Query('cursor', new ValidationPipe(PaginationCursorSchema))
      data: PaginationData,
    ): void {
      paginationData = data;
    }
  }

  @Module({
    controllers: [TestController],
    providers: [{ provide: APP_FILTER, useClass: ZodErrorFilter }],
  })
  class TestModule {}

  beforeEach(async () => {
    paginationData = undefined;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = createTestApplication(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  it('should use the default pagination without a cursor', async () => {
    await request(app.getHttpServer())
      .get('')
      .query('some_param=test')
      .expect(200);

    expect(paginationData).toEqual(
      new PaginationData(
        PaginationData.DEFAULT_LIMIT,
        PaginationData.DEFAULT_OFFSET,
      ),
    );
  });

  it('should use the limit and offset of the cursor', async () => {
    const limit = faker.number.int({ min: 1, max: 100 });
    const offset = faker.number.int({ min: 0, max: 1_000 });

    await request(app.getHttpServer())
      .get('')
      .query(`cursor=limit%3D${limit}%26offset%3D${offset}`)
      .expect(200);

    expect(paginationData).toEqual(new PaginationData(limit, offset));
  });

  it('should reject a cursor with a negative offset with a 422', async () => {
    const offset = faker.number.int({ min: 1, max: 1_000 });

    await request(app.getHttpServer())
      .get('')
      .query(`cursor=limit%3D20%26offset%3D-${offset}`)
      .expect(422);

    expect(paginationData).toBeUndefined();
  });
});

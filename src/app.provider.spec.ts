// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type INestApplication,
  Post,
  Req,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import request from 'supertest';
import { createFastifyAdapter, parseBodyLimit } from '@/app.provider';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Controller()
class ProbeController {
  @Get('ip')
  getIp(@Req() req: FastifyRequest): { ip: string } {
    return { ip: req.ip };
  }

  @Post('body')
  postBody(@Body() body: unknown): unknown {
    return body;
  }

  @Post('body-echo')
  @HttpCode(200)
  echoBody(@Body() body: unknown): { parsed: unknown } {
    return { parsed: body === undefined ? 'undefined' : body };
  }

  @Delete('resource')
  deleteResource(): void {}
}

describe('createFastifyAdapter', () => {
  let app: INestApplication;

  const createApp = async (trustProxy: string, jsonLimit = '1mb') => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('express.trustProxy', trustProxy);
    fakeConfigurationService.set('express.jsonLimit', jsonLimit);

    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: IConfigurationService, useValue: fakeConfigurationService },
      ],
    }).compile();

    const testApp = moduleRef.createNestApplication(
      createFastifyAdapter(fakeConfigurationService),
    );
    await testApp.init();
    await testApp.getHttpAdapter().getInstance().ready();
    return testApp;
  };

  afterEach(async () => {
    await app?.close();
  });

  it('resolves req.ip from X-Forwarded-For when trusting internal subnets', async () => {
    app = await createApp('loopback, uniquelocal');

    const { body } = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(body.ip).toBe('203.0.113.7');
  });

  it('ignores a forged leftmost X-Forwarded-For entry when trusting internal subnets', async () => {
    app = await createApp('loopback, uniquelocal');

    const { body } = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '1.2.3.4, 203.0.113.7');

    expect(body.ip).toBe('203.0.113.7');
  });

  it('supports a numeric hop count', async () => {
    app = await createApp('1');

    const { body } = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(body.ip).toBe('203.0.113.7');
  });

  it('falls back to the socket address when trust proxy is disabled', async () => {
    app = await createApp('0');

    const { body } = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(body.ip).toMatch(/127\.0\.0\.1$|::1$/);
  });

  it('enforces the configured JSON body size limit', async () => {
    app = await createApp('0', '8');

    await request(app.getHttpServer())
      .post('/body')
      .send({ value: 'too-large' })
      .expect(413);
  });

  it('accepts an empty body with a JSON content type', async () => {
    app = await createApp('0');

    await request(app.getHttpServer())
      .delete('/resource')
      .set('Content-Type', 'application/json')
      .expect(200);
  });

  it('parses an empty JSON body as {} like Express body-parser did', async () => {
    app = await createApp('0');

    const { body } = await request(app.getHttpServer())
      .post('/body-echo')
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(body).toEqual({ parsed: {} });
  });

  it('still rejects malformed JSON bodies', async () => {
    app = await createApp('0');

    await request(app.getHttpServer())
      .post('/body-echo')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
  });

  it('still rejects prototype-poisoning payloads', async () => {
    app = await createApp('0');

    await request(app.getHttpServer())
      .post('/body-echo')
      .set('Content-Type', 'application/json')
      .send('{"__proto__": {"polluted": true}}')
      .expect(400);
  });
});

describe('parseBodyLimit', () => {
  it('returns undefined when unset', () => {
    expect(parseBodyLimit(undefined)).toBeUndefined();
    expect(parseBodyLimit('')).toBeUndefined();
  });

  it('treats a bare number as bytes', () => {
    expect(parseBodyLimit('1024')).toBe(1024);
  });

  it.each([
    ['1b', 1],
    ['1kb', 1024],
    ['1mb', 1024 ** 2],
    ['1gb', 1024 ** 3],
    // tb/pb preserve parity with the `bytes` library Express used
    ['1tb', 1024 ** 4],
    ['2pb', 2 * 1024 ** 5],
  ])('parses unit suffix %s', (input, expected) => {
    expect(parseBodyLimit(input)).toBe(expected);
  });

  it('is case-insensitive and tolerates whitespace', () => {
    expect(parseBodyLimit(' 1 MB ')).toBe(1024 ** 2);
  });

  it('floors fractional values', () => {
    expect(parseBodyLimit('1.5kb')).toBe(1536);
  });

  it('throws on an unrecognised limit', () => {
    expect(() => parseBodyLimit('not-a-size')).toThrow(
      'Invalid JSON body size limit: not-a-size',
    );
  });
});

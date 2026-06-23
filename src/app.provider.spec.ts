// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  Req,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import request from 'supertest';
import { createFastifyAdapter } from '@/app.provider';
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
});

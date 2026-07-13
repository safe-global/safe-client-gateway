// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, type INestApplication, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { configureTrustProxy } from '@/app.provider';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Controller()
class IpProbeController {
  @Get('ip')
  getIp(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

describe('configureTrustProxy', () => {
  let app: INestApplication;

  const createApp = async (trustProxy: string): Promise<INestApplication> => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('express.trustProxy', trustProxy);

    const moduleRef = await Test.createTestingModule({
      controllers: [IpProbeController],
      providers: [
        { provide: IConfigurationService, useValue: fakeConfigurationService },
      ],
    }).compile();

    const testApp = moduleRef.createNestApplication();
    configureTrustProxy(testApp);
    await testApp.init();
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

    // Walking right-to-left, the trusted (loopback) socket is skipped and the
    // first public address wins; the client-supplied leftmost value (1.2.3.4)
    // is never reached.
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

    // Trust disabled: X-Forwarded-For is ignored and the loopback socket peer
    // is returned (127.0.0.1, ::ffff:127.0.0.1 or ::1).
    expect(body.ip).toMatch(/127\.0\.0\.1$|::1$/);
  });
});

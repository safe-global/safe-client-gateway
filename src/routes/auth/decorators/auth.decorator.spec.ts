import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { authPayloadBuilder } from '@/domain/auth/entities/__tests__/auth-payload.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import {
  INestApplication,
  Controller,
  Get,
  Module,
  UseGuards,
} from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('PaginationDataDecorator', () => {
  let app: INestApplication;
  let jwtService: IJwtService;
  let authPayloadFromDecoractor: AuthPayload;

  @Controller()
  class TestController {
    @Get('/open')
    nonAuthorizedRoute(@Auth() authPayload: AuthPayload): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }

    @UseGuards(AuthGuard)
    @Get('/auth')
    authorized(@Auth() authPayload: AuthPayload): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }
  }

  @Module({ imports: [AuthRepositoryModule], controllers: [TestController] })
  class TestModule {}

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    jwtService = app.get<IJwtService>(IJwtService);
    await app.init();
  });

  it('no token', async () => {
    await request(app.getHttpServer()).get('/open').expect(200);

    expect(authPayloadFromDecoractor).toBe(undefined);
  });

  it('with token', async () => {
    const authPayload = authPayloadBuilder().build();
    const accessToken = jwtService.sign(authPayload);

    await request(app.getHttpServer())
      .get('/auth')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);

    expect(authPayloadFromDecoractor).toStrictEqual(authPayload);
  });
});

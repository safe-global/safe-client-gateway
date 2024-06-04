import { TestAppProvider } from '@/__tests__/test-app.provider';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import {
  AuthPayload,
  AuthPayloadDto,
} from '@/domain/auth/entities/auth-payload.entity';
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
import { Server } from 'net';
import * as request from 'supertest';

describe('Auth decorator', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let authPayloadFromDecoractor: AuthPayloadDto;

  @Controller()
  class TestController {
    @Get('/open')
    nonAuthorizedRoute(@Auth() authPayload: AuthPayloadDto): void {
      authPayloadFromDecoractor = authPayload;
      return;
    }

    @UseGuards(AuthGuard)
    @Get('/auth')
    authorized(@Auth() authPayload: AuthPayloadDto): void {
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
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);
    jwtService = app.get<IJwtService>(IJwtService);
    await app.init();
  });

  it('no token', async () => {
    await request(app.getHttpServer()).get('/open').expect(200);

    expect(authPayloadFromDecoractor).toStrictEqual(new AuthPayload());
  });

  it('with token', async () => {
    const authPayloadDto = authPayloadDtoBuilder().build();
    const accessToken = jwtService.sign(authPayloadDto);

    await request(app.getHttpServer())
      .get('/auth')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);

    expect(authPayloadFromDecoractor).toStrictEqual(
      new AuthPayload(authPayloadDto),
    );
  });
});

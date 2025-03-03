import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TransactionValidityError } from '@/routes/transactions/errors/transaction-validity.error';
import { TransactionValidityExceptionFilter } from '@/routes/transactions/exception-filters/transaction-validity.exception-filter';
import { faker } from '@faker-js/faker/.';
import {
  Body,
  Controller,
  HttpStatus,
  INestApplication,
  Post,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TestingModule, Test } from '@nestjs/testing';
import { Server } from 'net';
import request from 'supertest';

@Controller()
class TestController {
  @Post('transaction-valditity')
  malformedHash(
    @Body() body: ConstructorParameters<typeof TransactionValidityError>[0],
  ): void {
    throw new TransactionValidityError(body);
  }
}

describe('TransactionValidityExceptionFilter', () => {
  let app: INestApplication<Server>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: TransactionValidityExceptionFilter,
        },
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should catch MalformedHash', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'MalformedHash' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Could not calculate safeTxHash',
      });
  });

  it('should catch HashMismatch', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'HashMismatch' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Invalid safeTxHash',
      });
  });

  it('should catch DuplicateOwners', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'DuplicateOwners' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Duplicate owners in confirmations',
      });
  });

  it('should catch DuplicateSignatures', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'DuplicateSignatures' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Duplicate signatures in confirmations',
      });
  });

  it('should catch UnrecoverableAddress', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'UnrecoverableAddress' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Could not recover address',
      });
  });

  it('should catch InvalidSignature', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'InvalidSignature' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Invalid signature',
      });
  });

  it('should catch EthSignDisabled', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'EthSignDisabled' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'eth_sign is disabled',
      });
  });

  it('should catch DelegateCallDisabled', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'DelegateCallDisabled' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Delegate call is disabled',
      });
  });

  it('should catch BlockedAddress', async () => {
    const code = faker.helpers.arrayElement([
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.BAD_GATEWAY,
    ]);

    await request(app.getHttpServer())
      .post('/transaction-valditity')
      .send({ code, type: 'BlockedAddress' })
      .expect(code)
      .expect({
        statusCode: code,
        message: 'Unauthorized address',
      });
  });
});

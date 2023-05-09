import { DefinedError } from 'ajv';
import { faker } from '@faker-js/faker';
import { ValidationErrorFactory } from './validation-error-factory';
import { ILoggingService } from '../../logging/logging.interface';

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

describe('ValidationErrorFactory', () => {
  const validationErrorFactory = new ValidationErrorFactory(mockLoggingService);

  it('should create an HttpException from an array of errors', async () => {
    const errors: DefinedError[] = [
      {
        instancePath: faker.random.word(),
        schemaPath: faker.random.word(),
        keyword: 'additionalProperties',
        params: { additionalProperty: faker.random.word() },
        message: faker.random.word(),
      },
    ];

    const err = validationErrorFactory.from(errors);

    expect(err.message).toBe('Validation failed');
    expect(err.getStatus()).toBe(500);
    expect(err.getResponse()['code']).toBe(42);
    expect(err.getResponse()['message']).toBe('Validation failed');
    expect(err.getResponse()['arguments']).toEqual([]);
  });
});

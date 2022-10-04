import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import safeFactory from './entities/__tests__/safe.factory';
import { SafeValidator } from './safe.validator';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Safe validator', () => {
  const validator = new SafeValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const safe = safeFactory();
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(safe);

    expect(result).toBe(safe);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const safe = safeFactory();
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(safe)).toThrow(errMsg);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

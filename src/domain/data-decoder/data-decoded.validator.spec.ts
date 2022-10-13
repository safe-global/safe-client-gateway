import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { DataDecodedValidator } from './data-decoded.validator';
import dataDecodedFactory from './entities/__tests__/data-decoded.factory';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('DataDecoded validator', () => {
  const validator = new DataDecodedValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const dataDecoded = dataDecodedFactory();
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(dataDecoded);

    expect(result).toBe(dataDecoded);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const dataDecoded = dataDecodedFactory();
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(dataDecoded)).toThrow(errMsg);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

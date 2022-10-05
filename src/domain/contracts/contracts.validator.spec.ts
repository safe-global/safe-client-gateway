import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { ContractsValidator } from './contracts.validator';
import contractFactory from './entities/__tests__/contract.factory';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Contracts validator', () => {
  const validator = new ContractsValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const contract = contractFactory();
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(contract);

    expect(result).toBe(contract);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const contract = contractFactory();
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(contract)).toThrow(errMsg);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

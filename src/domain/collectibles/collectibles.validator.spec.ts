import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { CollectiblesValidator } from './collectibles.validator';
import collectibleFactory from './entities/__tests__/collectible.factory';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Collectible validator', () => {
  const validator = new CollectiblesValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const collectible = collectibleFactory();
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(collectible);

    expect(result).toBe(collectible);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const collectible = collectibleFactory();
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(collectible)).toThrow(errMsg);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { SimpleValidator } from './simple.validator';
import { ValidationErrorFactory } from './validation-error-factory';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

describe('Simple validator', () => {
  const simpleValidator = new SimpleValidator(mockValidationErrorFactory);

  it('should throw a validation error when validation fails', async () => {
    const validationFunction = jest.fn().mockImplementation(() => false);
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() =>
      simpleValidator.execute(
        validationFunction as unknown as ValidateFunction,
        {},
      ),
    ).toThrow(errMsg);

    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

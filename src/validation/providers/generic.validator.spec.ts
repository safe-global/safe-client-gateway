import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { ValidationErrorFactory } from '@/validation/providers/validation-error-factory';
import { GenericValidator } from '@/validation/providers/generic.validator';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as jest.MockedObjectDeep<ValidationErrorFactory>);

describe('Generic validator', () => {
  const genericValidator = new GenericValidator(mockValidationErrorFactory);

  it('should throw a validation error when validation fails', async () => {
    const validationFunction = (
      jest.fn() as jest.MockedFunctionDeep<ValidateFunction>
    ).mockImplementation(() => false);
    const errMsg = faker.word.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() => genericValidator.validate(validationFunction, {})).toThrow(
      errMsg,
    );

    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});

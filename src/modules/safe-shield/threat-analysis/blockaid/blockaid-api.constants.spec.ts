import { prepareErrorMessage } from './blockaid-api.constants';

describe('prepareErrorMessage', () => {
  describe('when error contains a valid error code', () => {
    it.each([
      ['GS000', 'Unable to set up your Safe. Please refresh and try again.'],
      [
        'GS001',
        'Please specify how many signatures are required for transactions.',
      ],
      [
        'GS002',
        'This account is not a contract. Modules can only be enabled on contract addresses.',
      ],
      [
        'GS010',
        'Insufficient funds to cover transaction fees. Please add funds or reduce gas.',
      ],
      [
        'GS011',
        'Unable to pay transaction fees with ETH. Please ensure you have enough ETH in your Safe.',
      ],
      [
        'GS012',
        'Unable to pay transaction fees with the selected token. Please use ETH or check token balance.',
      ],
      [
        'GS013',
        'Transaction failed due to incorrect gas settings. Please set a gas price.',
      ],
      ['GS020', 'Invalid signature format. Please try signing again.'],
      [
        'GS021',
        'Signature validation failed. Please contact support with error code GS021.',
      ],
      [
        'GS022',
        'Signature validation failed. Please contact support with error code GS022.',
      ],
      ['GS023', 'Incomplete signature data. Please try signing again.'],
      [
        'GS024',
        'The signature is invalid. Please check your wallet connection and try again.',
      ],
      ['GS025', 'This action requires approval from Safe signers first.'],
      [
        'GS026',
        'This address is not a signer of this Safe. Please use a valid signer address.',
      ],
      [
        'GS030',
        'Only Safe signers can approve this action. Please connect with a signer wallet.',
      ],
      ['GS031', 'This action must be initiated from within the Safe.'],
      [
        'GS100',
        'Safe modules are already set up and cannot be initialized again.',
      ],
      [
        'GS101',
        'The module address is invalid. Please verify the address and try again.',
      ],
      ['GS102', 'This module is already installed on your Safe.'],
      ['GS103', 'Unable to update Safe modules. Please refresh and try again.'],
      ['GS104', 'This action can only be performed by an enabled Safe module.'],
      [
        'GS105',
        'Invalid starting point for fetching paginated modules. Please refresh and try again.',
      ],
      ['GS106', 'Invalid page size for fetching paginated modules.'],
      [
        'GS200',
        'Safe signers are already configured and cannot be set up again.',
      ],
      [
        'GS201',
        'Required signatures cannot be more than the number of signers. Please adjust the threshold.',
      ],
      ['GS202', 'At least one signature is required for transactions.'],
      [
        'GS203',
        'The signer address is invalid. Please enter a valid Ethereum address.',
      ],
      ['GS204', 'This address is already a signer of this Safe.'],
      [
        'GS205',
        'Unable to update signers. Please refresh the page and try again.',
      ],
      [
        'GS300',
        'The guard contract is incompatible with this Safe. Please use a compatible guard.',
      ],
      [
        'GS301',
        'The module guard is incompatible. Please replace it with a supported version.',
      ],
      [
        'GS400',
        'Fallback handler cannot be the Safe itself. Use a different address.',
      ],
    ])(
      'should map error code %s to user-friendly message',
      (errorCode, expectedMessage) => {
        const error = `Error: ${errorCode}`;
        const result = prepareErrorMessage(error);

        expect(result).toBe(expectedMessage);
      },
    );

    it('should extract error code from error string in single quotation marks', () => {
      const error = `Reverted with reason string: 'GS030'`;
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'Only Safe signers can approve this action. Please connect with a signer wallet.',
      );
    });

    it('should extract error code from error string without quotation marks', () => {
      const error = `Reverted with reason string: GS301`;
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'The module guard is incompatible. Please replace it with a supported version.',
      );
    });

    it('should extract first error code when multiple codes are present', () => {
      const error = 'GS010: Insufficient gas. Also GS020: Invalid signature';
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'Insufficient funds to cover transaction fees. Please add funds or reduce gas.',
      );
    });

    it('should extract error code from middle of error string', () => {
      const error = `Reverted with reason string: 'GS013'. Additional context`;
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'Transaction failed due to incorrect gas settings. Please set a gas price.',
      );
    });
  });

  describe('when error does not contain a valid error code', () => {
    it('should return the original error string', () => {
      const error = 'Generic error message without code';
      const result = prepareErrorMessage(error);

      expect(result).toBe(error);
    });

    it('should return original error for code that matches pattern but not in mapping', () => {
      // GS123 matches the pattern but is not in the mapping, so it returns original error
      const error = 'Error code GS123 is not in mapping';
      const result = prepareErrorMessage(error);

      expect(result).toBe(error);
    });

    it('should return the original error string for code without GS prefix', () => {
      const error = 'Error code 030 is invalid';
      const result = prepareErrorMessage(error);

      expect(result).toBe(error);
    });

    it('should return the original error string for code with wrong format', () => {
      const error = 'Error code GS30 is too short';
      const result = prepareErrorMessage(error);

      expect(result).toBe(error);
    });

    it('should return original error for non-existent error code in mapping', () => {
      const error = 'Error code GS999 does not exist';
      const result = prepareErrorMessage(error);

      expect(result).toBe(error);
    });
  });

  describe('when error is undefined or empty', () => {
    it('should return undefined when error is undefined', () => {
      const result = prepareErrorMessage(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined when error is empty string', () => {
      const result = prepareErrorMessage('');

      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle error code at the start of string', () => {
      const error = 'GS030';
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'Only Safe signers can approve this action. Please connect with a signer wallet.',
      );
    });

    it('should handle error code at the end of string', () => {
      const error = 'Error occurred: GS301';
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'The module guard is incompatible. Please replace it with a supported version.',
      );
    });

    it('should handle error code with special characters around it', () => {
      const error = 'Error (GS010) occurred';
      const result = prepareErrorMessage(error);

      expect(result).toBe(
        'Insufficient funds to cover transaction fees. Please add funds or reduce gas.',
      );
    });

    it('should handle error code with whitespace', () => {
      const error = 'Error: GS 030 with space';
      const result = prepareErrorMessage(error);

      expect(result).toBe(error); // Should return original since space breaks the pattern
    });
  });
});

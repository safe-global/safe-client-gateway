// SPDX-License-Identifier: FSL-1.1-MIT
import {
  addDelegateEncoder,
  deleteAllowanceEncoder,
  removeDelegateEncoder,
  resetAllowanceEncoder,
  setAllowanceEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/allowance-module-encoder.builder';
import { AllowanceModuleDecoder } from '@/modules/contracts/domain/decoders/allowance-module-decoder.helper';

describe('AllowanceModuleDecoder', () => {
  let target: AllowanceModuleDecoder;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new AllowanceModuleDecoder();
  });

  describe('decodeFunctionData', () => {
    it('decodes an addDelegate function call correctly', () => {
      const addDelegate = addDelegateEncoder();
      const args = addDelegate.build();
      const data = addDelegate.encode();

      expect(target.decodeFunctionData({ data })).toEqual({
        functionName: 'addDelegate',
        args: [args.delegate],
      });
    });

    it('decodes a removeDelegate function call correctly', () => {
      const removeDelegate = removeDelegateEncoder();
      const args = removeDelegate.build();
      const data = removeDelegate.encode();

      expect(target.decodeFunctionData({ data })).toEqual({
        functionName: 'removeDelegate',
        args: [args.delegate, args.removeAllowances],
      });
    });

    it('decodes a setAllowance function call correctly', () => {
      const setAllowance = setAllowanceEncoder();
      const args = setAllowance.build();
      const data = setAllowance.encode();

      expect(target.decodeFunctionData({ data })).toEqual({
        functionName: 'setAllowance',
        args: [
          args.delegate,
          args.token,
          args.allowanceAmount,
          args.resetTimeMin,
          args.resetBaseMin,
        ],
      });
    });

    it('decodes a resetAllowance function call correctly', () => {
      const resetAllowance = resetAllowanceEncoder();
      const args = resetAllowance.build();
      const data = resetAllowance.encode();

      expect(target.decodeFunctionData({ data })).toEqual({
        functionName: 'resetAllowance',
        args: [args.delegate, args.token],
      });
    });

    it('decodes a deleteAllowance function call correctly', () => {
      const deleteAllowance = deleteAllowanceEncoder();
      const args = deleteAllowance.build();
      const data = deleteAllowance.encode();

      expect(target.decodeFunctionData({ data })).toEqual({
        functionName: 'deleteAllowance',
        args: [args.delegate, args.token],
      });
    });
  });

  describe('helpers', () => {
    it('recognizes each function by its selector', () => {
      expect(target.helpers.isAddDelegate(addDelegateEncoder().encode())).toBe(
        true,
      );
      expect(
        target.helpers.isRemoveDelegate(removeDelegateEncoder().encode()),
      ).toBe(true);
      expect(
        target.helpers.isSetAllowance(setAllowanceEncoder().encode()),
      ).toBe(true);
      expect(
        target.helpers.isResetAllowance(resetAllowanceEncoder().encode()),
      ).toBe(true);
      expect(
        target.helpers.isDeleteAllowance(deleteAllowanceEncoder().encode()),
      ).toBe(true);
    });

    it('returns false for a call to a different function', () => {
      expect(target.helpers.isAddDelegate(setAllowanceEncoder().encode())).toBe(
        false,
      );
    });
  });
});

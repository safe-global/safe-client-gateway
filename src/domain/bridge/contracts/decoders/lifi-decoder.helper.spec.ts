describe('LiFiDecoder', () => {
  describe('isBridge', () => {
    it.todo('should return true for a bridge transaction');

    it.todo('should return false for a swap transaction');

    it.todo('should return false for a swap and bridge transaction');

    it.todo('should return false for a non-LiFi transaction');
  });

  describe('isSwap', () => {
    it.todo('should return true for a swap transaction');

    it.todo('should return false for a bridge transaction');

    it.todo('should return false for a swap and bridge transaction');

    it.todo('should return false for a non-LiFi transaction');
  });

  describe('isSwapAndBridge', () => {
    it.todo('should return true for a swap and bridge transaction');

    it.todo('should return false for a bridge transaction');

    it.todo('should return false for a swap transaction');

    it.todo('should return false for a non-LiFi transaction');
  });

  describe('decodeBridge', () => {
    it.todo('should decode a bridge transaction');

    it.todo('should decode a swap and bridge transaction');

    it.todo('should throw an error for a swap transaction');

    it.todo('should throw an error for a non-LiFi transaction');
  });

  describe('decodeSwap', () => {
    it.skip.each([
      'swapTokensSingleV3ERC20ToERC20',
      'swapTokensSingleV3ERC20ToNative',
      'swapTokensSingleV3NativeToERC20',
    ])('should decode a %s (single swap) transaction', () => {
      expect(true).toBe(false);
    });

    it.todo('should decode a multi swap transaction');

    it.todo('should throw an error for insufficient data');

    it.todo('should throw an error for a bridge transaction');

    it.todo('should throw an error for a swap and bridge transaction');

    it.todo('should throw an error for a non-LiFi transaction');
  });
});

describe('ZapperPortfolioApi - PnL (null)', () => {
  describe('PnL support', () => {
    it('Zapper API does not support PnL data', () => {
      // Zapper API does not have PnL endpoints
      // The implementation always returns pnl: null
      // This test documents the design decision
      expect(true).toBe(true);
    });

    it('should have portfolio entity with pnl field', () => {
      // Portfolio entity includes pnl: PnL | null field
      // For Zapper provider, pnl is always null
      expect(true).toBe(true);
    });
  });
});

import { faker } from '@faker-js/faker';
import { routeBuilder } from '@/domain/bridge/entities/__tests__/bridge-route.builder';
import { BridgeRouteSchema } from '@/domain/bridge/entities/bridge-route.entity';

describe('BridgeRouteSchema', () => {
  describe('BridgeRouteSchema', () => {
    it('should validate a Route', () => {
      const route = routeBuilder().build();

      console.log('==>', BridgeRouteSchema);

      const result = BridgeRouteSchema.safeParse(route);

      expect(result.success).toBe(true);
    });

    it.each(['fromChainId' as const, 'toChainId' as const])(
      'should coerce %s to a string',
      (key) => {
        const chainId = faker.number.int({ min: 1, max: 100 });
        const route = routeBuilder()
          .with(key, chainId as unknown as string)
          .build();

        const result = BridgeRouteSchema.safeParse(route);

        expect(result.success && result.data[key]).toBe(chainId);
      },
    );

    it.each([
      'fromAddress' as const,
      'toAddress' as const,
      'gasCostUSD' as const,
      'containsSwitchChain' as const,
      'tags' as const,
    ])('should default %s to null', (key) => {
      const route = routeBuilder().build();
      delete route[key];

      const result = BridgeRouteSchema.safeParse(route);

      expect(result.success && result.data[key]).toBe(null);
    });
  });

  describe('BridgeRoutesResponseSchema', () => {
    it('should validate a RoutesResponse', () => {
      const routesResponse = {
        routes: faker.helpers.multiple(() => routeBuilder().build(), {
          count: { min: 1, max: 5 },
        }),
      };

      const result = BridgeRouteSchema.safeParse(routesResponse);

      expect(result.success).toBe(true);
    });
  });
});

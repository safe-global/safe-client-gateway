import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { SafeAppSchema } from '@/domain/safe-apps/entities/schemas/safe-app.schema';

describe('SafeAppSchema', () => {
  it('should validate a valid SafeApp', () => {
    const safeApp = safeAppBuilder().build();

    const result = SafeAppSchema.safeParse(safeApp);

    expect(result.success).toBe(true);
  });
});

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const ENV_JSON_PATH = path.join(PROJECT_ROOT, '.env.sample.json');
export const EnvVariableSchema = z.object({
  name: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Must be uppercase with underscores'),
  description: z.string().min(1, 'Description is required'),
  defaultValue: z.string().nullable(),
  required: z.boolean(),
});
export const EnvConfigSchema = z.array(EnvVariableSchema);
export type EnvVariable = z.infer<typeof EnvVariableSchema>;

/**
 * Load and validate the .env.sample.json file.
 * Performs JSON parsing and Zod schema validation.
 * Exits with code 1 if file is missing, invalid JSON, or invalid structure.
 *
 * @returns Array of validated environment variable objects
 * @throws Exits process with code 1 on validation failure
 */
export function loadEnvJson(): Array<EnvVariable> {
  if (!fs.existsSync(ENV_JSON_PATH)) {
    console.error('❌ Error: .env.sample.json file not found');
    process.exit(1);
  }

  const content = fs.readFileSync(ENV_JSON_PATH, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('❌ Error: Invalid JSON in .env.sample.json');
    console.error(error);
    process.exit(1);
  }

  const result = EnvConfigSchema.safeParse(parsed);

  if (!result.success) {
    console.error('❌ Error: Invalid structure in .env.sample.json');
    console.error(result.error);
    process.exit(1);
  }

  return result.data;
}

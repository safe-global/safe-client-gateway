import * as fs from 'fs';
import * as path from 'path';
import { PROJECT_ROOT, loadEnvJson } from './env-json-helpers';

const ENV_OUTPUT_PATH = path.join(PROJECT_ROOT, '.env');
const FORCE_MODE = process.argv.includes('--force');

/**
 * Generate .env file from required variables
 */
function generateEnvFile(): void {
  if (FORCE_MODE) {
    console.log(
      '🔧 Generating .env file (FORCE MODE - will overwrite existing file)...\n',
    );
  } else {
    console.log('🔧 Generating .env file from .env.sample.json...\n');
  }

  if (fs.existsSync(ENV_OUTPUT_PATH) && !FORCE_MODE) {
    console.error('❌ Error: .env file already exists');
    console.error(
      '💡 Please delete or backup your existing .env file before generating a new one.',
    );
    console.error('   Or use: yarn env:generate:force to overwrite\n');
    process.exit(1);
  }

  const envVars = loadEnvJson();
  const requiredVars = envVars.filter((v) => v.required);
  const optionalVarsWithDefaults = envVars.filter(
    (v) => !v.required && v.defaultValue !== null,
  );

  console.log(`Found ${requiredVars.length} required variables`);
  console.log(
    `Found ${optionalVarsWithDefaults.length} optional variables with defaults\n`,
  );

  // Generate .env content
  const lines: Array<string> = [];

  // Header
  lines.push(
    '# ==============================================================================',
  );
  lines.push('# Safe Client Gateway Environment Variables');
  lines.push(
    '# ==============================================================================',
  );
  lines.push(
    '# This file was generated from .env.sample.json with required variables and defaults.',
  );
  lines.push(
    '# Please update the placeholder values with your actual configuration.',
  );
  lines.push(
    '# ==============================================================================',
  );
  lines.push('');

  // Required variables
  if (requiredVars.length > 0) {
    lines.push(
      '# ==============================================================================',
    );
    lines.push('# REQUIRED VARIABLES');
    lines.push(
      '# ==============================================================================',
    );
    lines.push('');

    for (const envVar of requiredVars) {
      lines.push(`# ${envVar.description}`);
      if (envVar.defaultValue !== null) {
        lines.push(`${envVar.name}=${envVar.defaultValue}`);
      } else {
        lines.push(`${envVar.name}=`);
      }

      lines.push('');
    }
  }

  if (optionalVarsWithDefaults.length > 0) {
    lines.push(
      '# ==============================================================================',
    );
    lines.push('# OPTIONAL VARIABLES WITH DEFAULTS');
    lines.push(
      '# ==============================================================================',
    );
    lines.push(
      '# Uncomment and modify these variables if you want to override the defaults',
    );
    lines.push(
      '# ==============================================================================',
    );
    lines.push('');

    for (const envVar of optionalVarsWithDefaults) {
      lines.push(`# ${envVar.description}`);
      lines.push(`# Default: ${envVar.defaultValue}`);
      lines.push(`# ${envVar.name}=${envVar.defaultValue}`);

      lines.push('');
    }
  }

  fs.writeFileSync(ENV_OUTPUT_PATH, lines.join('\n'), 'utf-8');

  if (FORCE_MODE) {
    console.log(
      '✅ Successfully regenerated .env file (overwrote existing)!\n',
    );
  } else {
    console.log('✅ Successfully generated .env file!\n');
  }
  console.log('📋 Summary:');
  console.log(`   Required variables:                ${requiredVars.length}`);
  console.log(
    `   Optional variables with defaults:  ${optionalVarsWithDefaults.length}`,
  );
  console.log();
  console.log('⚠️  Next steps:');
  console.log('   1. Review the generated .env file');
  console.log('   2. Update all required variables with actual values');
  console.log('   3. Uncomment and modify optional variables as needed');
  console.log();
}

try {
  generateEnvFile();
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error('❌ Error:', error);
  process.exit(1);
}

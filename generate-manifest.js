const { readFileSync, writeFileSync } = require('fs'); // eslint-disable-line @typescript-eslint/no-var-requires

(() => {
  const packageJson = JSON.parse(
    readFileSync('package.json', { encoding: 'utf-8' }),
  );
  
  writeFileSync('manifest.json', JSON.stringify({
    name: packageJson.name,
    version: packageJson.version,
  }));
})()

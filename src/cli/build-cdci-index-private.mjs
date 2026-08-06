#!/usr/bin/env node

import { main } from './build-cdci-index.mjs';

main(['--profile', 'internal-evaluation', ...process.argv.slice(2)]).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

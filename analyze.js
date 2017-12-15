#!/usr/bin/env node
require('yargs')
  .usage('Usage: $0 [options]')
  .commandDir('./analysis')
  .demandCommand()
  .recommendCommands()
  .help()
  .alias('h', 'help')
  .env('BITDO')
  .epilog('Environment variables settable with prefix BITDO_')
  .parse();

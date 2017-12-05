#!/usr/bin/env node
const config = require('./config');
const Exchanges = require('./exchanges');

const args = require('yargs')
  .usage('Usage: $0 [options]')
  .help('h')
  .alias('h', 'help')
  .describe('p', 'Product set to track for this order in format EXCHANGE:PRODUCT-RELATION eg GDAX:BTC-USD')
  .alias('p', 'product')
  .string('p')
  .demand('p', 'A product is required')
  .describe('track', 'Track the order until it is filled')
  .boolean('track')
  .default('track', true)
  .command('buy', 'Create an order to buy a product', sub => {
    return sub
      .thing1;
  })
  .demandCommand()
  .recommendCommands();

args.parse();

console.dir(args);

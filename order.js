#!/usr/bin/env node
const config = require('./config');
const Exchanges = require('./exchanges');
const log = require('./log');
const winston = require('winston');
const parsers = require('./lib/parsers');

log.add(winston.transports.Console, {
  colorize: true,
  timestamp: true,
  prettyPrint: true,
  level: 'debug',
});

function waitForOrderFill(exchange, orderId, frequencySecs = 10) {
  log.info(`Waiting for order to fill. Polling every ${frequencySecs}s...`);
  return new Promise((resolve, reject) => {
    const intv = setInterval(() => {
      log.info('Polling...');
      exchange.getOrder(orderId)
        .then(order => {
          if (order.settled) {
            log.info(`Order settled in status: ${order.status}`);
            clearInterval(intv);
            resolve(orderId);
          }
        }).catch(err => {
          clearInterval(intv);
          reject(err);
        });
    }, frequencySecs * 1000);
  });
}

function createOrder(side, args) {
  const product = parsers.parseProduct(args.product);
  log.info(`Creating ${side} order for ${args.amount} on ${product.exchange}:${product.symbol}-${product.relation} at ${args.price}...`);

  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange]);
  return exchange.createLimitOrder(side, `${product.relation}-${product.symbol}`, args.amount, args.price)
    .then(order => {
      log.info(`Order successfully created with id ${order.id}`);
      if (!args.notrack)
        return waitForOrderFill(exchange, order.id, args.pollsecs);
      return order;
    });
}

/* eslint arrow-body-style: off */
const args = require('yargs')
  .usage('Usage: $0 [options]')
  .help('h')
  .alias('h', 'help')
  .describe('p', 'Product set to track for this order in format EXCHANGE:PRODUCT-RELATION eg GDAX:BTC-USD')
  .alias('p', 'product')
  .string('p')
  .demand('p', 'A product is required')
  .describe('pollsecs', 'Set the number of seconds for polling')
  .number('pollsecs')
  .default('pollsecs', 10)
  .describe('notrack', 'Dont track the order')
  .boolean('notrack')
  .default('notrack', false)
  .command('buy', 'Create an order to buy a product', sub => {
    return sub
      .describe('price', 'Price at which to buy product')
      .string('price')
      .demand('price')
      .describe('amount', 'Amount of product to buy')
      .string('amount')
      .demand('amount');
  }, v => createOrder('buy', v))
  .command('sell', 'Create a sell order', sub => {
    return sub
      .describe('price', 'Price at which to buy product')
      .string('price')
      .demand('price')
      .describe('amount', 'Amount of product to buy')
      .string('amount')
      .demand('amount');
  }, v => createOrder('sell', v))
  .command('help <command>', 'Show help for command', {}, () => args.showHelp())
  .demandCommand()
  .recommendCommands();

args.parse();

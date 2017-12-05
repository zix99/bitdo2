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
  log.info('Waiting for order to fill...');
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

function cmdCreateBuy(args) {
  const product = parsers.parseProduct(args.product);
  log.info(`Buying ${args.amount} ${product.exchange}:${product.symbol}-${product.relation} at ${args.price}...`);

  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange]);
  exchange.createLimitOrder('buy', `${product.relation}-${product.symbol}`, args.amount, args.price)
    .then(order => {
      log.info(`Order successfully created with id ${order.id}`);
      if (args.track)
        return waitForOrderFill(exchange, order.id);
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
  .describe('track', 'Track the order until it is filled')
  .boolean('track')
  .default('track', true)
  .command('buy', 'Create an order to buy a product', sub => {
    return sub
      .describe('price', 'Price at which to buy product')
      .string('price')
      .demand('price')
      .describe('amount', 'Amount of product to buy')
      .string('amount')
      .demand('amount');
  }, cmdCreateBuy)
  .command('help <command>', 'Show help for command', {}, () => args.showHelp())
  .demandCommand()
  .recommendCommands();

args.parse();

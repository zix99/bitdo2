#!/usr/bin/env node
const config = require('./config');
const Exchanges = require('./exchanges');
const log = require('./log');
const winston = require('winston');
const parsers = require('./lib/parsers');
const _ = require('lodash');

log.add(winston.transports.Console, {
  colorize: true,
  timestamp: true,
  prettyPrint: true,
  level: 'debug',
});

function intervalPromise(func, millis) {
  return new Promise((resolve, reject) => {
    const intv = setInterval(() => {
      Promise.resolve(func()).then(ret => {
        if (ret !== undefined && ret !== null) {
          clearInterval(intv);
          resolve(ret);
        }
      }).catch(err => {
        clearInterval(intv);
        reject(err);
      });
    }, millis);
  });
}

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

// Ability to resolve "special" prices (like percentages and 'all')
function computeRelativeAmount(amount, relative) {
  if (amount.toUpperCase() === 'ALL')
    return relative;
  if (amount.endsWith('%')) {
    const percentage = parseFloat(amount.substr(0, amount.length - 1)) / 100.0;
    return parseFloat(relative) * percentage;
  }
  return amount;
}

function getCurrentProductStats(exchange, symbol) {
  return exchange.getHolding(symbol)
    .catch(() => {})
    .then(holding => {
      log.info(`Current ${symbol} stats:`);
      log.info(`  Balance:   ${holding.balance}`);
      log.info(`  Available: ${holding.available}`);
      return holding;
    });
}

function createOrder(side, args) {
  const product = parsers.parseProduct(args.product);
  log.info(`Creating ${side} order for ${args.amount} on ${product.exchange}:${product.symbol}-${product.relation} at ${args.price}...`);

  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange]);
  return getCurrentProductStats(exchange, product.symbol)
    .then(holding => {
      const resolvedAmount = computeRelativeAmount(args.amount, holding.available);
      log.info(`Creating ${side} @ ${args.price} #${resolvedAmount}...`);
      return exchange.createLimitOrder(side, product.symbol, product.relation, resolvedAmount, args.price)
        .then(order => {
          log.info(`Order successfully created with id ${order.id}`);
          if (!args.notrack)
            return waitForOrderFill(exchange, order.id, args.pollsecs);
          return order;
        });
    });
}

function trailingSell(args) {
  const product = parsers.parseProduct(args.product);
  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange]);

  log.info(`Trailing ${args.product}...`);
  const priceHistory = [];

  exchange.getTicker(product.symbol, product.relation)
    .then(initialTicker => {
      priceHistory.push(initialTicker.price);
    }).then(() => {
      return intervalPromise(() => {
        log.info('Polling trailing stop....');
        return exchange.getTicker(product.symbol, product.relation)
          .then(ticker => {
            const mean = _.mean(priceHistory);
            const stopTrigger = mean - mean * (args.trail / 100.0);
            const stopLimit = stopTrigger - stopTrigger * (args.offsetprice / 100.0);

            // add to price history after computing the mean
            priceHistory.push(ticker.price);
            if (priceHistory.length > args.smaperiods)
              priceHistory.shift();

            log.debug(`Price ${ticker.price} < ${stopTrigger}?`);

            if (ticker.price <= stopTrigger) {
              log.warn(`Ticker ${ticker.price} is less than trigger price of ${stopTrigger}.  Creating sell order at ${stopLimit}`);
              exchange.createLimitOrder('sell', product.symbol, product.relation, args.amount, stopLimit)
                .then(order => {
                  if (!args.notrack)
                    return waitForOrderFill(exchange, order.id, args.pollsecs);
                  return order;
                });
              return true; // We're done here
            }
            return null;
          });
      }, args.pollsecs * 1000);
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
      .describe('amount', 'Amount of product to buy. Can be real number, percentage offset, or `all`')
      .string('amount')
      .demand('amount');
  }, v => createOrder('buy', v))
  .command('sell', 'Create a sell order', sub => {
    return sub
      .describe('price', 'Price at which to buy product')
      .string('price')
      .demand('price')
      .describe('amount', 'Amount of product to buy. Can be real number, percentage offset, or `all`')
      .string('amount')
      .demand('amount');
  }, v => createOrder('sell', v))
  .command('trailsell', 'Create a trailing sell monitor', sub => {
    return sub
      .describe('amount', 'The amount to sell if hit the limit')
      .number('amount')
      .demand('amount')
      .describe('trail', 'The percentage at which to trail the moving average')
      .number('trail')
      .default('trail', 5.0)
      .describe('smaperiods', 'The number of periods to compute the current price')
      .number('smaperiods')
      .default('smaperiods', 90)
      .describe('offsetprice', 'The percentage at which to offset the price of the stop')
      .number('offsetprice')
      .default('offsetprice', 1.0);
  }, trailingSell)
  .command('help <command>', 'Show help for command', {}, () => args.showHelp())
  .demandCommand()
  .recommendCommands();

args.parse();

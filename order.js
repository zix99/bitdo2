#!/usr/bin/env node
const Promise = require('bluebird');
const config = require('./config');
const Exchanges = require('./exchanges');
const log = require('./log').enableConsole();
const parsers = require('./lib/parsers');
const _ = require('lodash');

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

  let isCanceling = false;
  process.on('SIGINT', () => {
    if (isCanceling) {
      log.warn('Forcing quit, operation may have not finished!');
      process.exit(2); // force quit
    }

    isCanceling = true;
    log.info(`Exit requested, canceling order: ${orderId}...`);
    exchange.cancelOrder(orderId)
      .then(() => {
        log.info('Order canceled, exiting..');
        process.exit(0);
      }).catch(err => {
        log.warn(`Error canceling order! ${err.message}`);
        process.exit(1);
      });
  });

  return new Promise((resolve, reject) => {
    const intv = setInterval(() => {
      log.info(`Polling order ${orderId}...`);
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
  if (`${amount}`.toUpperCase() === 'ALL')
    return relative;
  if (`${amount}`.endsWith('%')) {
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

function createExchangeOrder(exchange, side, parsedProduct, amount, price, args = {}, spread = 0, spreadRatio = 0.00025) {
  log.info(`Creating ${side} order for ${amount} on ${parsedProduct.exchange}:${parsedProduct.symbol}-${parsedProduct.relation} at ${price}...`);
  return getCurrentProductStats(exchange, parsedProduct.symbol)
    .then(holding => {
      const resolvedAmount = computeRelativeAmount(amount, holding.available);

      if (resolvedAmount <= 0) {
        log.warn('Resolved amount is 0, cannot create order');
        process.exit(1);
      }

      log.info(`Creating ${side} @ ${price} #${resolvedAmount}...`);
      const orders = [];
      for (let i = 0; i <= spread; i++) {
        orders.push(exchange.createLimitOrder(side, parsedProduct.symbol, parsedProduct.relation, resolvedAmount / (spread * 2 + 1), price + price * spreadRatio * i));
        if (i !== 0)
          orders.push(exchange.createLimitOrder(side, parsedProduct.symbol, parsedProduct.relation, resolvedAmount / (spread * 2 + 1), price + price * spreadRatio * -i));
      }

      return Promise.all(orders)
        .map(order => {
          log.info(`Order successfully created with id ${order.id}`);
          if (!args.notrack && !order.settled)
            return waitForOrderFill(exchange, order.id, args.pollsecs || 10);
          return order;
        });
    });
}

function createOrder(side, args) {
  const product = parsers.parseProduct(args.product);
  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange], { simulate: args.simulate });
  return createExchangeOrder(exchange, side, product, args.amount, args.price, args, args.spread, args.spreadratio);
}


function trailingSell(args) {
  const product = parsers.parseProduct(args.product);
  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange], { simulate: args.simulate });

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
            if (priceHistory.length === 0) {
              // prefill
              for (let i = 0; i < args.smaperiods; i++)
                priceHistory.push(ticker.price);
            } else {
              priceHistory.push(ticker.price);
              if (priceHistory.length > args.smaperiods)
                priceHistory.shift();
            }

            log.debug(`Price ${ticker.price} < ${stopTrigger}?`);

            if (ticker.price <= stopTrigger) {
              log.warn(`Ticker ${ticker.price} is less than trigger price of ${stopTrigger}.  Creating sell order at ${stopLimit}`);
              createExchangeOrder(exchange, 'sell', product, args.amount, stopLimit, args);
              return true; // We're done here
            }
            return null;
          }).catch(err => {
            log.warn(`Error polling trailing sell: ${err.message}`);
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
  .describe('simulate', 'Simulate all ordering')
  .boolean('simulate')
  .default('simulate', false)
  .alias('simulate', 's')
  .command('buy', 'Create an order to buy a product', sub => {
    return sub
      .describe('price', 'Price at which to buy product')
      .number('price')
      .demand('price')
      .describe('amount', 'Amount of product to buy. Can be real number, percentage offset, or `all`')
      .number('amount')
      .demand('amount')
      .describe('spread', 'Number of orders to spread buy across')
      .number('spread')
      .default('spread', 0)
      .describe('spreadratio', 'Ratio to spread out orders in each spread')
      .number('spreadratio')
      .default('spreadratio', 0.00025);
  }, v => createOrder('buy', v))
  .command('sell', 'Create a sell order', sub => {
    return sub
      .describe('price', 'Price at which to buy product')
      .number('price')
      .demand('price')
      .describe('amount', 'Amount of product to buy. Can be real number, percentage offset, or `all`')
      .number('amount')
      .demand('amount')
      .describe('spread', 'Number of orders to spread sell across')
      .number('spread')
      .default('spread', 0)
      .describe('spreadratio', 'Ratio to spread out orders in each spread')
      .number('spreadratio')
      .default('spreadratio', 0.00025);
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

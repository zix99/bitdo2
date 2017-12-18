#!/usr/bin/env node
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');
const duration = require('./lib/duration');
const Exchanges = require('./exchanges');
const config = require('./config');
const parsers = require('./lib/parsers');
const log = require('./log');

log.enableConsole();

const args = require('yargs')
  .describe('product', 'The product to watch')
  .alias('product', 'p')
  .describe('crosses', 'Succeed if the price crosses this amount')
  .number('crosses')
  .describe('above', 'Triggers if price goes above this value')
  .number('above')
  .describe('below', 'Triggers if price goes below this value')
  .number('below')
  .describe('orderid', 'Order id to watch for changes on')
  .describe('settled', 'Watches an orderid until it is settled')
  .boolean('settled')
  .describe('poll', 'Frequency, in seconds, to poll at')
  .number('poll')
  .default('poll', 10)
  .describe('timeout', 'How long to wait before timing out the watch. Number and unit, eg 10s 5m 2h 3d, etc')
  .default('timeout', null)
  .example('$0 -p gdax:BTC-USD --crosses 20000')
  .help('h')
  .alias('h', 'help')
  .env('BITDO')
  .epilog('Environment variables settable with prefix BITDO_')
  .argv;

const product = parsers.parseProduct(args.product);
const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange]);

const state = {
  lastTicker: null,
};

const RESULT = {
  PASS: 1,
  NOPASS: 2,
  FAIL: 3,
};

const EXITCODES = {
  SUCCESS: 0,
  FAIL: 1,
  TIMEDOUT: 2,
  BAD_REQUEST: 10,
};

const startTime = moment();

function poll() {
  log.info(`Polling for updates on ${args.product}...`);

  // Check timeout
  if (args.timeout) {
    const timePassed = moment() - startTime;
    const timeoutDuration = duration.parse(args.timeout);
    if (timePassed > timeoutDuration) {
      log.warn(`Polling timed out after ${args.timeout}`);
      process.exit(EXITCODES.TIMEDOUT);
    }
  }

  // Each query returns true or false (or error)
  const queries = [];

  // Common enough to "share"
  const tickerQuery = exchange.getTicker(product.symbol, product.relation);

  if (args.crosses) {
    queries.push(tickerQuery
      .then(ticker => {
        if (!state.lastTicker)
          return RESULT.NOPASS;

        if ((state.lastTicker.price < args.crosses && ticker.price >= args.crosses)
          || (state.lastTicker.price > args.crosses && ticker.price <= args.crosses))
          return RESULT.PASS;
        return RESULT.NOPASS;
      }));
  }

  if (args.below) {
    queries.push(tickerQuery
      .then(ticker => {
        if (ticker.price < args.below)
          return RESULT.PASS;
        return RESULT.NOPASS;
      }));
  }

  if (args.above) {
    queries.push(tickerQuery
      .then(ticker => {
        if (ticker.price >= args.above)
          return RESULT.PASS;
        return RESULT.NOPASS;
      }));
  }

  if (args.settled) {
    if (!args.orderid) {
      log.error('Need orderid to watch settled state and one was not provided');
      process.exit(EXITCODES.BAD_REQUEST);
    }
    queries.push(exchange.getOrder(args.orderid)
      .then(order => {
        if (order.settled)
          return RESULT.PASS;
        return RESULT.NOPASS;
      }));
  }

  // After all other queries to set the previous price
  tickerQuery.then(ticker => {
    state.lastTicker = ticker;
  });

  Promise.all(queries)
    .then(results => {
      if (_.every(results, x => x === RESULT.PASS)) {
        log.info('All queries have passed');
        process.exit(EXITCODES.SUCCESS);
      }
      if (_.some(results, x => x === RESULT.FAIL)) {
        log.info('Query has failed');
        process.exit(EXITCODES.FAIL);
      }
    }).catch(err => {
      log.warn(`Error while executing queries: ${err.message}`);
    });
}

poll();
setInterval(poll, args.poll * 1000);

#!/usr/bin/env node
const log = require('./log');
const HoldingsService = require('./services/holdings');
const Exchanges = require('./exchanges');
const config = require('./config');
const DB = require('./lib/db');

/*
This script will record holdings over time to a database.
Defaults to local sqlite DB
*/

const args = require('yargs')
  .describe('db', 'Database connections tring')
  .default('db', config.db || 'sqlite://db.sqlite')
  .describe('interval', 'Number of minutes between holding fetchings')
  .number('interval')
  .default('interval', 5)
  .alias('interval', 'i')
  .describe('verbose', 'Display debug info')
  .alias('verbose', 'v')
  .boolean('verbose')
  .env('BITDO')
  .epilog('Environment variables settable with prefix BITDO_')
  .argv;

log.enableConsole(args.verbose ? 'debug' : 'info');

const exchanges = Exchanges.createFromConfig(config.exchanges);
const holdings = new HoldingsService(exchanges);

const { Holdings, db } = DB(args.db);

function scrapeHoldings() {
  log.info('Fetching holdings...');
  const ts = new Date();
  return holdings.getHoldings()
    .map(holding => {
      log.info(`Holding: ${holding.balance} of ${holding.currency}`);
      return Holdings.create({
        exchange: holding.exchange.name.toUpperCase(),
        symbol: holding.currency.toUpperCase(),
        amount: holding.balance,
        amountBtc: holding.conversions.BTC,
        amountUsd: holding.conversions.USD,
        ts,
      });
    }).catch(err => {
      log.warn(`Error while scraping holdings: ${err.message}`);
    });
}

function main() {
  setInterval(scrapeHoldings, args.interval * 60 * 1000);
  scrapeHoldings();
}

db.sync().then(main);

#!/usr/bin/env node
const Sequelize = require('sequelize');
const log = require('./log');
const HoldingsService = require('./services/holdings');
const Exchanges = require('./exchanges');
const config = require('./config');

/*
This script will record holdings over time to a database.
Defaults to local sqlite DB
*/

const args = require('yargs')
  .describe('db', 'Database connections tring')
  .default('db', 'sqlite://db.sqlite')
  .describe('interval', 'Number of minutes between holding fetchings')
  .number('interval')
  .default('interval', 5)
  .alias('interval', 'i')
  .describe('verbose', 'Display debug info')
  .alias('verbose', 'v')
  .boolean('verbose')
  .argv;

log.enableConsole(args.verbose ? 'debug' : 'info');

const exchanges = Exchanges.createFromConfig(config.exchanges);
const holdings = new HoldingsService(exchanges);

const db = new Sequelize(args.db, {
  logging: txt => log.debug(txt),
});

const DBHoldings = db.define('holdings', {
  exchange: Sequelize.STRING,
  symbol: Sequelize.STRING,
  amount: Sequelize.DOUBLE,
  amountBtc: Sequelize.DOUBLE,
  amountUsd: Sequelize.DOUBLE,
}, {
  indexes: [
    { fields: ['exchange', 'symbol'] },
    { fields: ['createdAt'] },
  ],
});

function scrapeHoldings() {
  log.info('Fetching holdings...');
  holdings.getHoldings()
    .map(holding => {
      log.info(`Holding: ${holding.balance} of ${holding.currency}`);
      return DBHoldings.create({
        exchange: holding.exchange.name.toUpperCase(),
        symbol: holding.currency.toUpperCase(),
        amount: holding.balance,
        amountBtc: holding.conversions.BTC,
        amountUsd: holding.conversions.USD,
      });
    });
}

function main() {
  setInterval(scrapeHoldings, args.interval * 60 * 1000);
  scrapeHoldings();
}

db.sync().then(main);

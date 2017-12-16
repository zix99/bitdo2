#!/usr/bin/env node
const Promise = require('bluebird');
const Plugins = require('./plugins');
const Exchanges = require('./exchanges');
const config = require('./config');
const _ = require('lodash');
const HoldingsService = require('./services/holdings');
const DB = require('./lib/db');
const moment = require('moment');
const log = require('./log');
const fs = require('fs');

log.enableConsole();

/*
Uses the web plugin to generate your own custom dashboard
*/

const args = require('yargs')
  .describe('db', 'Database URL')
  .string('db')
  .default('db', config.db || 'sqlite://db.sqlite')
  .describe('poll', 'How many seconds between polls')
  .number('poll')
  .default('poll', 60)
  .describe('history', 'Number of ticks ot keep in history')
  .number('history')
  .default('history', 2880)
  .describe('state', 'Filename to save state')
  .string('state')
  .env('BITDO')
  .epilog('Environment variables settable with prefix BITDO_')
  .argv;

const { Holdings } = DB(args.db);
const exchanges = Exchanges.createFromConfig(config.exchanges);
const holdingsService = new HoldingsService(exchanges);
const plugins = Plugins.createFromConfig({
  web: {},
});

function loadState() {
  if (args.state && fs.existsSync(args.state)) {
    log.info(`Loading state file ${args.state}`);
    try {
      const raw = fs.readFileSync(args.state, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      log.error(`Unable to read state file: ${err.message}`);
    }
  }
  return { tickers: {} };
}

const { tickers } = loadState();

function update() {
  holdingsService.getHoldings()
    .then(holdings => _.orderBy(holdings, h => h.conversions.USD, 'desc'))
    .then(holdings => _.filter(holdings, h => h.balance > 0))
    .then(holdings => [
      holdings,
      Promise.map(exchanges, exch => exch.getOrders()).then(_.flatten),
    ])
    .spread((holdings, orders) => {
      plugins.graph('holdings', {
        type: 'bar',
        data: {
          labels: _.map(holdings, 'currency'),
          datasets: [{
            label: 'USD',
            backgroundColor: 'rgba(255,0,0,0.5)',
            borderColor: 'rgba(255,0,0,1.0)',
            borderWidth: 1,
            data: _.map(holdings, 'conversions.USD'),
          }],
        },
      });

      _.each(holdings, ({ currency, ticker, balance, exchange }) => {
        if (currency === 'USD')
          return;

        if (!tickers[currency]) {
          tickers[currency] = {
            prices: [],
          };
        }
        const currencyTicker = tickers[currency];

        currencyTicker.prices.push({
          ts: new Date(),
          price: ticker.USD,
          balance,
        });
        while (currencyTicker.prices.length > args.history)
          currencyTicker.prices.shift();

        plugins.graph(`holdings-${exchange.name}-${currency}`, {
          type: 'bar',
          data: {
            labels: _.map(currencyTicker.prices, 'ts'),
            datasets: [{
              type: 'line',
              label: 'USD-Price',
              fill: true,
              pointRadius: 0,
              backgroundColor: 'rgba(255,0,0,0.5)',
              borderColor: 'rgba(255,0,0,1.0)',
              data: _.map(currencyTicker.prices, 'price'),
              yAxisID: 'y-axis-1',
            }, {
              type: 'bar',
              label: 'Balance',
              fill: true,
              borderWidth: 1,
              backgroundColor: 'rgba(127,127,127,0.2)',
              borderColor: 'rgba(127,127,127,0.5)',
              data: _.map(currencyTicker.prices, 'balance'),
              yAxisID: 'y-axis-2',
            }, {
              type: 'line',
              label: 'Buys',
              backgroundColor: 'rgba(0,255,0,0.4)',
              borderColor: 'rgba(0,255,0,0.8)',
              data: _(orders)
                .filter(o => o.product.substr(0, 3) === currency
                  && o.exchange.name === exchange.name
                  && o.status === 'F'
                  && o.side === 'buy'
                  && moment(o.date) >= moment(_(currencyTicker).map('ts').min()).subtract(1, 'week'))
                .map(o => ({ x: o.date, y: o.price, text: `${o.size}` })),
              fill: true,
              pointRadius: 10,
              pointHoverRadius: 15,
              showLine: false,
            }, {
              type: 'line',
              label: 'Sells',
              backgroundColor: 'rgba(128,0,255,0.4)',
              borderColor: 'rgba(128,0,255,0.8)',
              data: _(orders)
                .filter(o => o.product.substr(0, 3) === currency
                  && o.exchange.name === exchange.name
                  && o.status === 'F'
                  && o.side === 'sell'
                  && moment(o.date) >= moment(_(currencyTicker).map('ts').min()).subtract(1, 'week'))
                .map(o => ({ x: o.date, y: o.price, text: `${o.size}` })),
              fill: true,
              pointRadius: 10,
              pointHoverRadius: 15,
              showLine: false,
            }],
          },
          options: {
            stacked: false,
            title: {
              text: `[${exchange.name}] ${currency}`,
            },
            scales: {
              xAxes: [{
                type: 'time',
                distribution: 'series',
                ticks: {
                  source: 'labels',
                  minRotation: 30,
                  autoSkip: true,
                },
                time: {
                  tooltipFormat: 'll HH:mm',
                },
              }],
              yAxes: [{
                type: 'linear',
                display: true,
                position: 'left',
                id: 'y-axis-1',
              }, {
                type: 'linear',
                display: true,
                position: 'right',
                id: 'y-axis-2',
                gridLines: {
                  drawOnChartArea: false,
                },
              }],
            },
          },
        });
      });
    });

  Holdings.findSumOverTime({
    where: {
      createdAt: { $gt: moment().subtract(7, 'day').toDate() },
    },
  }).then(results => {
    if (results.length > 0) {
      plugins.graph('Long-term-USD', {
        type: 'line',
        data: {
          labels: _.map(results, 'ts'),
          datasets: [{
            label: 'USD',
            fill: true,
            pointRadius: 0,
            backgroundColor: 'rgba(255,0,0,0.5)',
            borderColor: 'rgba(255,0,0,1.0)',
            borderWidth: 1,
            data: _.map(results, x => x.get('sumUsd')),
          }],
        },
        options: {
          scales: {
            xAxes: [{
              type: 'time',
              distribution: 'series',
              ticks: {
                source: 'labels',
                minRotation: 30,
                autoSkip: true,
              },
              time: {
                tooltipFormat: 'll HH:mm',
              },
            }],
          },
        },
        html: {
          width: '66%',
        },
      });
    }
  });
}

function save(cb) {
  try {
    if (args.state) {
      log.debug('Saving state...');
      const out = JSON.stringify({ tickers });
      return fs.writeFile(args.state, out, 'utf8', (err) => {
        if (!err)
          log.info(`Saved state to ${args.state}`);
        else
          log.warn(`Error saving state to ${args.state}: ${err.message}`);
        if (cb)
          cb();
      });
    }
  } catch (err) {
    log.error(`Failed saving state to ${args.state}: ${err.message}`);
  }
  if (cb)
    cb();
  return null;
}

setInterval(update, args.poll * 1000);
update();

process.on('SIGINT', () => {
  save(() => {
    process.exit(0);
  });
});

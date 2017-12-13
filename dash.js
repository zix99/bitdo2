#!/usr/bin/env node
const Web = require('./plugins/web');
const Exchanges = require('./exchanges');
const config = require('./config');
const _ = require('lodash');
const HoldingsService = require('./services/holdings');
const DB = require('./lib/db');
const moment = require('moment');
const log = require('./log');

log.enableConsole();

/*
Uses the web plugin to generate your own custom dashboard
*/

const args = require('yargs')
  .describe('db', 'Database URL')
  .string('db')
  .default('db', 'sqlite://db.sqlite')
  .argv;

const { Holdings } = DB(args.db);
const exchanges = Exchanges.createFromConfig(config.exchanges);
const holdingsService = new HoldingsService(exchanges);
const web = Web();

const tickers = {};

function update() {
  holdingsService.getHoldings()
    .then(holdings => _.orderBy(holdings, h => h.conversions.USD, 'desc'))
    .then(holdings => _.filter(holdings, h => h.balance > 0))
    .then(holdings => {
      web.graph('holdings', {
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

      _.each(holdings, ({ currency, ticker, balance }) => {
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

        web.graph(`holdings-${currency}`, {
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
            }],
          },
          options: {
            stacked: false,
            scales: {
              xAxes: [{
                type: 'time',
                distribution: 'series',
                ticks: {
                  source: 'labels',
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
      web.graph('Long-term-USD', {
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
              },
            }],
          },
        },
      });
    }
  });
}

setInterval(update, 30 * 1000);
update();

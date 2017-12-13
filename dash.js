#!/usr/bin/env node
const Web = require('./plugins/web');
const Exchanges = require('./exchanges');
const config = require('./config');
const _ = require('lodash');
const HoldingsService = require('./services/holdings');

/*
Uses the web plugin to generate your own custom dashboard
*/

const exchanges = Exchanges.createFromConfig(config.exchanges);
const holdingsService = new HoldingsService(exchanges);
const web = Web({});

function update() {
  holdingsService.getHoldings()
    .then(holdings => _.orderBy(holdings, h => h.conversions.USD, 'desc'))
    .then(holdings => _.filter(holdings, h => h.balance > 0))
    .then(holdings => {
      web.pushData('holdings', {
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
    });
}

setInterval(update, 5000);

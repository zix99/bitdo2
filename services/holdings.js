const Conversions = require('./conversions');
const _ = require('lodash');
const Promise = require('bluebird');
const log = require('../log');

class Holdings {
  constructor(exchanges, opts = {}) {
    this.__exchanges = exchanges;
    this.__conversions = Conversions(exchanges);
    this.__opts = _.assign({
      allOrFail: false,
    }, opts);
  }

  getHoldings() {
    return Promise.map(this.__exchanges, exchange => {
      return exchange.getHoldings()
        .catch(err => {
          log.warn(`Error fetching holdings for ${exchange.name}: ${err.message}`);
          if (this.__opts.allOrFail)
            throw err;
          return [];
        });
    }).then(_.flatten)
      .map(holding => this.__decorateHolding(holding));
  }

  __getRate(currency, relation) {
    return this.__conversions.getRate(currency, relation)
      .catch(err => {
        log.warn(`Error fetching conversion for ${currency}:${relation}: ${err.message}`);
        if (this.__opts.allOrFail)
          throw err;
        return 0;
      });
  }

  __decorateHolding(holding) {
    return Promise.all([
      this.__getRate(holding.currency, 'BTC'),
      this.__getRate(holding.currency, 'USD'),
    ]).spread((btc, usd) => _.assign({
      conversions: {
        BTC: btc * holding.balance,
        USD: usd * holding.balance,
      },
      ticker: {
        USD: usd,
        BTC: btc,
      },
    }, holding));
  }
}

module.exports = Holdings;

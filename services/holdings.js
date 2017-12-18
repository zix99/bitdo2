const Conversions = require('./conversions');
const _ = require('lodash');
const Promise = require('bluebird');

class Holdings {
  constructor(exchanges) {
    this.__exchanges = exchanges;
    this.__conversions = Conversions(exchanges);
  }

  getHoldings() {
    return Promise.map(this.__exchanges, exchange => exchange.getHoldings().catch(() => []))
      .then(_.flatten)
      .map(holding => this.__decorateHolding(holding));
  }

  __decorateHolding(holding) {
    return Promise.all([
      this.__conversions.getRate(holding.currency, 'BTC').catch(() => 0),
      this.__conversions.getRate(holding.currency, 'USD').catch(() => 0),
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

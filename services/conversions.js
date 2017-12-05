const memoize = require('memoizee');
const Promise = require('bluebird');
const _ = require('lodash');

module.exports = exchanges => {
  const lib = {
    __getMarketMap() {
      return Promise.map(exchanges, exchange => exchange.getMarkets())
        .then(_.flatten)
        .then(markets => _.keyBy(markets, market => `${market.currency}:${market.relation}`));
    },

    /* Get conversion rate, allows for jumping through BTC */
    getRateTickers(currency, target) {
      if (currency === target)
        return Promise.resolve(1.0);

      return this.getMarketMap(currency, target)
        .then(markets => {
          const mainkey = `${currency}:${target}`;
          if (_.has(markets, mainkey))
            return markets[mainkey].exchange.getTicker(currency, target).then(ret => ret.price);

          const flipkey = `${target}:${currency}`;
          if (_.has(markets, flipkey))
            return markets[flipkey].exchange.getTicker(currency, target).then(ret => 1.0 / ret.price);

          throw new Error(`Unable to translate market ${mainkey}`);
        });
    },

    getRate(currency, target) {
      /* eslint arrow-body-style: off */
      return this.getRateTickers(currency, target)
        .catch(() => {
          // Try resolving via BTC
          return Promise.all([
            this.getRateTickers(currency, 'BTC'),
            this.getRateTickers('BTC', target),
          ]).spread((viabtc, totarget) => viabtc * totarget);
        });
    },
  };

  lib.getMarketMap = memoize(lib.__getMarketMap, { maxAge: 60 * 60 * 1000, promise: true });

  return lib;
};

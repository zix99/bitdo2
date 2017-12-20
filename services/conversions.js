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
    __getRateTicker(currency, target) {
      if (currency === target)
        return Promise.resolve(1.0);

      return this.getMarketMap(currency, target)
        .then(markets => {
          const mainkey = `${currency}:${target}`;
          if (_.has(markets, mainkey))
            return markets[mainkey].exchange.getTicker(currency, target).then(ret => ret.price || 0);

          const flipkey = `${target}:${currency}`;
          if (_.has(markets, flipkey))
            return markets[flipkey].exchange.getTicker(target, currency).then(ret => 1.0 / (ret.price || 1));

          return null; // We succeeded in not being able to find a conversion
        });
    },

    getRate(currency, target) {
      /* eslint arrow-body-style: off */
      return this.getRateTicker(currency, target)
        .then(pureRate => {
          if (pureRate !== null)
            return pureRate;

          // Try resolving via BTC
          return Promise.all([
            this.getRateTicker(currency, 'BTC'),
            this.getRateTicker('BTC', target),
          ]).spread((viabtc, totarget) => (viabtc === null || totarget === null ? null : viabtc * totarget));
        });
    },
  };

  lib.getRateTicker = memoize(lib.__getRateTicker, { maxAge: 10 * 1000, promise: true });
  lib.getMarketMap = memoize(lib.__getMarketMap, { maxAge: 60 * 60 * 1000, promise: true });

  return lib;
};

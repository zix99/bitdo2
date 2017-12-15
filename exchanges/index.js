const _ = require('lodash');
const memoize = require('memoizee');
const fs = require('fs');
const proxyLogger = require('./proxyLogger');
const proxyOrderSimulate = require('./proxyOrderSimulate');

/**
Most function implementations need to be provider, with some exceptions where
a function can be inferred from another (eg getting a single holding from a list, but not vice versa)

Error handling:
- All functions are to return a promise, even if it isn't necessary, for consistency
- If there an error (eg connection, or otherwise), reject the promise
- If data doesn't exist, and that makes sense (eg. no order with given id), resolve to null
*/

class Exchange {
  constructor(name, impl) {
    this.name = name.toUpperCase();
    this._impl = impl;

    this.getMarkets = memoize(this.__getMarkets, {
      maxAge: 1000 * 60 * 60 * 6, // 6 hours
    });
  }

  getTicker(currency, relation) {
    /*
    {
      price: float:data.price,
      volume: float:data.volume,
      //META:
      exchange: this,
      currency,
      relation,
    }
    */
    return this._impl.getTicker(currency, relation)
      .then(ticker => _.assign({ exchange: this, currency, relation, id: `${this.name}:${currency}-${relation}` }, ticker));
  }

  getHoldings() {
    /*
    [{
      id: arbitrary-id,
      currency: 3-letter currency symbol,
      balance: float:balance,
      available: float:avail,
      hold: float:hold,
      //META:
      exchange: this
    }]
    */
    return this._impl.getHoldings()
      .map(holding => _.assign({ exchange: this, updatedAt: new Date() }, holding));
  }

  // Gets a single getHoldings()
  // Will use impl.getHolding() if available, otherwise it will get all and filter
  getHolding(currency) {
    if (this._impl.getHolding) {
      return this._impl.getHolding(currency)
        .then(holding => _.assign({ exchange: this, updateAt: new Date() }, holding));
    }

    return this.getHoldings()
      .then(holdings => {
        const match = _.find(holdings, x => x.currency === currency);
        if (!match)
          throw new Error(`Unable to find holdings for currency ${currency}`);
        return match;
      });
  }

  getOrders() {
    /*
    [{
      status: 'O', // O=open, F=filled, X=canceled/rejected, ? = unknown/other
      product: order.product, // eg RDD-BTC
      price: order.price, (per unit)
      size: order.size,
      date: order.created_at,
      type: order.type, // limit, market
      side: order.side, // sell, buy
      fee: order.fill_fees,
      //META:
      exchange: this
    }]
    */
    return this._impl.getOrders()
      .map(order => _.assign({ exchange: this }, order));
  }

  __getMarkets() {
    /* [{
      currency: product.base_currency,
      relation: product.quote_currency,
      //META:
      exchange: this,
    }] */
    return this._impl.getMarkets()
      .map(market => _.assign({ exchange: this }, market));
  }

  // Create a LIMIT order
  //  side: buy/sell
  //  product: Product id (eg BTC-USD)
  //  size: Amount to buy/sell (string or float)
  //  price: Amount to buy/sell at (assumes LIMIT) (string or float)
  createLimitOrder(side, currency, relation, size, price) {
    /* {
      id: 'abcdef', // whatever id used to represent the trade
      settled: true/false, // If the order has been immediately settled
    } */
    return this._impl.createLimitOrder(side, currency, relation, size, price)
      .then(ret => _.assign({ exchange: this, side, currency, relation, size, price }, ret));
  }

  // Get order details from orderId
  getOrder(orderId) {
    /* {
      settled: true/false,
      status: 'F', // Same set as order list
      price: ...,
      quantity: ...,
      product: ...,
    } */
    return this._impl.getOrder(orderId)
      .then(ret => _.assign({ exchange: this, id: orderId }, ret));
  }

  cancelOrder(orderId) {
    /* Ret: {} */
    return this._impl.cancelOrder(orderId)
      .then(ret => _.assign({ exchange: this, id: orderId }, ret));
  }

  getOrderBook(currency, relation, bucketsize = 0.01) {
    /*
    Special note: Once this contract is returned, it will be bucketed and sorted
    {
      buys: [{
        price: 123.11,  // Price point
        size: 100.23,   // Total size/volume at this price point
        orders: 1,      // Number of orders at this price point (default: 1)
      }, ...],
      sells: [...]      // Same data as buys
    } */
    function bucketData(data) {
      const bucketed = _.groupBy(data, item => ~~(item.price / bucketsize) * bucketsize);
      return _.map(bucketed, (items, bucket) => ({
        price: parseFloat(bucket),
        size: _.sumBy(items, 'size'),
        orders: _.sumBy(items, x => x.orders || 1),
      }));
    }
    return this._impl.getOrderBook(currency, relation, bucketsize)
      .then(book => ({
        buys: _.orderBy(bucketData(book.buys), x => x.price),
        sells: _.orderBy(bucketData(book.sells), x => x.price),
      }))
      .then(ret => _.assign({ exchange: this, currency, relation }, ret));
  }
}

/* eslint global-require: off */
/* eslint import/no-dynamic-require: off */
function requireExchange(name, config) {
  if (fs.existsSync(`${__dirname}/${name}`))
    return require(`./${name}`)(config);
  if (fs.existsSync(`${__dirname}/${name}.js`))
    return require(`./${name}.js`)(config);
  return require(`bitdo-exchange-${name}`)(config);
}

module.exports = {
  createExchange(name, config, opts = {}) {
    let exchange = requireExchange(name, config);
    exchange.name = name.toUpperCase();
    if (opts.log || config.log)
      exchange = proxyLogger(exchange);
    if (opts.simulate || config.simulate)
      exchange = proxyOrderSimulate(exchange);
    return new Exchange(name, exchange);
  },

  createFromConfig(configSet, opts = {}) {
    return _.map(configSet, (exchangeConfig, key) => this.createExchange(key, exchangeConfig, opts));
  },
};

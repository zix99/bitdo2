const _ = require('lodash');
const memoize = require('memoizee');
const fs = require('fs');

function Exchange(name, impl) {
  this.name = name.toUpperCase();
  this._impl = impl;

  this.getMarkets = memoize(this.__getMarkets, {
    maxAge: 1000 * 60 * 60 * 6, // 6 hours
  });
}

Exchange.prototype.getTicker = function getTicker(currency, relation) {
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
};

Exchange.prototype.getHoldings = function getHoldings() {
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
};

Exchange.prototype.getOrders = function getOrders() {
  /*
  [{
    status: 'O', // O=open, F=filled, X=canceled/rejected, ? = unknown/other
    product: order.product,
    price: order.price, (per unit)
    size: order.size,
    date: order.created_at,
    type: order.type,
    side: order.size,
    fee: order.fill_fees,
    //META:
    exchange: this
  }]
  */
  return this._impl.getOrders()
    .map(order => _.assign({ exchange: this }, order));
};

Exchange.prototype.__getMarkets = function __getMarkets() {
  /* [{
    currency: product.base_currency,
    relation: product.quote_currency,
    //META:
    exchange: this,
  }] */
  return this._impl.getMarkets()
    .map(market => _.assign({ exchange: this }, market));
};

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
  createExchange(name, config) {
    // Simple for now, will wrap in the future.
    return new Exchange(name, requireExchange(name, config));
  },
};

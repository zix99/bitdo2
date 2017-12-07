const Promise = require('bluebird');

/* eslint no-unused-vars: off */

module.exports = (config) => ({
  getHoldings() {
    return Promise.resolve([]);
  },

  getOrders() {
    return Promise.resolve([]);
  },

  getMarkets() {
    return Promise.resolve([
      {
        currency: 'MCK',
        relation: 'USD',
      },
    ]);
  },

  getTicker(currency, relation) {
    return Promise.resolve({
      price: 100,
      volume: 1000,
    });
  },

  createLimitOrder() {
    return Promise.resolve({
      id: 'abc',
    });
  },

  cancelOrder() {
    return Promise.resolve({});
  },
});

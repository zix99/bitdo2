const _ = require('lodash');
const moment = require('moment');
const shortid = require('shortid');
const log = require('../log');

/* eslint no-unused-vars: off */

module.exports = impl => {
  const ORDERS = {};
  let BALANCE = 0;

  /* eslint no-param-reassign: off */
  function evaluateOrder(order) {
    if (order.settled)
      return Promise.resolve(order); // already settled

    const [currency, relation] = order.product.split('-');

    return impl.getTicker(currency, relation)
      .then(ticker => {
        if (order.side === 'buy' && order.price >= ticker.price) {
          log.info(`Simulating execution of buy for ${order.id}`);
          order.status = 'F';
          order.settled = true;
          BALANCE -= order.price * order.size;
        }
        if (order.side === 'sell' && order.price <= ticker.price) {
          log.info(`Simulating execution of sell for ${order.id}`);
          order.status = 'F';
          order.settled = true;
          BALANCE += order.price * order.size;
        }

        if (order.settled)
          log.warn(`  Updated balance: ${BALANCE}`);
        return order;
      });
  }

  const orderSimulator = {
    getOrder(orderId) {
      if (_.has(ORDERS, orderId))
        return Promise.resolve(ORDERS[orderId]);
      return impl.getOrder(orderId);
    },

    getOrders() {
      return impl.getOrders()
        .then(realOrders => {
          return _.map(ORDERS, order => order)
            .concat(realOrders);
        });
    },

    createLimitOrder(side, currency, relation, size, price) {
      log.warn(`Creating simulated ${side} order on ${currency}-${relation} at @${price} #${size}...`);
      if (price <= 0 || size <= 0)
        throw new Error('Not valid price or size');
      if (!currency || !relation)
        throw new Error('Must specify currency and relation');
      if (side !== 'buy' && side !== 'sell')
        throw new Error('Must be buy or sell');

      const id = shortid();
      const order = {
        id,
        status: 'O',
        settled: false,
        product: `${currency.toUpperCase()}-${relation.toUpperCase()}`,
        price,
        size,
        date: moment().format(),
        type: 'limit',
        side,
        fee: 0.0,
      };

      ORDERS[id] = order;

      return evaluateOrder(order)
        .then(eOrder => ({
          id,
          settled: eOrder.settled,
        }));
    },

    cancelOrder(orderId) {
      log.warn('Trying to cancel simulated order (will not fall-through)...');
      if (_.has(ORDERS, orderId)) {
        delete ORDERS[orderId];
        return Promise.resolve({});
      }
      return Promise.reject(new Error('No such order'));
    },
  };

  return new Proxy(impl, {
    get(obj, prop) {
      return _.get(orderSimulator, prop, obj[prop]);
    },

    set(obj, prop) {
      return false;
    },

    apply(obj, prop) {
      return null;
    },
  });
};

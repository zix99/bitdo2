const Promise = require('bluebird');
const axios = require('axios');
const crypto = require('crypto');
const _ = require('lodash');

/* eslint arrow-body-style: off */

module.exports = exchangeOpts => {
  const config = _.merge({
    passphrase: null,
    key: null,
    b64secret: null,
    host: 'https://api.gdax.com',
  }, exchangeOpts);

  function createSignedHeadersAsync(epoch, method, uri, serializedBody) {
    return new Promise((resolve, reject) => {
      const hmac = crypto.createHmac('sha256', Buffer.from(config.b64secret, 'base64'));
      hmac.on('readable', () => {
        const data = hmac.read();
        if (data) {
          resolve({
            'CB-ACCESS-KEY': config.key,
            'CB-ACCESS-SIGN': data.toString('base64'),
            'CB-ACCESS-TIMESTAMP': epoch,
            'CB-ACCESS-PASSPHRASE': config.passphrase,
          });
        } else
          reject(new Error('Error creating signature headers'));
      });
      hmac.write(`${epoch}`);
      hmac.write(method.toUpperCase());
      hmac.write(uri);
      if (serializedBody)
        hmac.write(serializedBody);
      hmac.end();
    });
  }

  function executeRequest(method, uri, body) {
    const serializedBody = body ? JSON.stringify(body) : undefined;
    const epoch = ~~(new Date() / 1000);

    return createSignedHeadersAsync(epoch, method, uri, serializedBody)
      .then(headers => {
        return axios({
          method,
          url: `${config.host}${uri}`,
          data: serializedBody,
          headers: _.assign(headers, {
            'Content-Type': 'application/json',
          }),
        });
      }).then(resp => resp.data);
  }

  function getStatusCode(status) {
    switch (status) {
      case 'done': return 'F';
      case 'active': return 'O';
      case 'open': return 'O';
      case 'rejected': return 'X';
      default: return '?';
    }
  }

  return {
    getOrders() {
      return executeRequest('GET', '/orders?status=all')
        .map(order => {
          return {
            status: getStatusCode(order.status),
            product: order.product_id,
            price: order.price,
            size: order.size,
            date: order.created_at,
            type: order.type,
            side: order.side,
            fee: order.fill_fees,
          };
        });
    },

    getHoldings() {
      return executeRequest('GET', '/accounts')
        .map(account => {
          return {
            id: account.id,
            currency: `${account.currency}`,
            balance: parseFloat(account.balance),
            available: parseFloat(account.available),
            hold: parseFloat(account.hold),
          };
        });
    },

    getMarkets() {
      return executeRequest('GET', '/products')
        .map(product => {
          return {
            currency: product.base_currency,
            relation: product.quote_currency,
          };
        });
    },

    getTicker(currency, relation) {
      return executeRequest('GET', `/products/${currency}-${relation}/ticker`)
        .then(data => {
          return {
            price: parseFloat(data.price),
            volume: parseFloat(data.volume),
          };
        });
    },

    createLimitOrder(side, currency, relation, size, price) {
      return executeRequest('POST', '/orders', {
        size,
        price,
        product_id: `${currency}-${relation}`,
        side,
      }).then(data => ({
        id: data.id,
        settled: data.settled,
      }));
    },

    getOrder(orderId) {
      return executeRequest('GET', `/orders/${orderId}`)
        .then(order => ({
          settled: order.settled,
          status: getStatusCode(order.status),
          price: order.funds,
          quantity: order.size,
          product: order.product_id,
        }));
    },

    cancelOrder(orderId) {
      return executeRequest('DELETE', `/orders/${orderId}`)
        .then(() => ({}));
    },
  };
};

const crypto = require('crypto');
const axios = require('axios');
const uuid = require('uuid/v4');
const Promise = require('bluebird');
const querystring = require('querystring');
const _ = require('lodash');

/* eslint arrow-body-style: off */

module.exports = exchangeOpts => {
  const config = _.merge({
    host: 'https://bittrex.com',
    apikey: null,
    apisecret: null,
  }, exchangeOpts);

  function createSignature(uri, nonce) {
    const hmac = crypto.createHmac('sha512', config.apisecret);
    return hmac.update(uri).digest('hex');
  }

  function makeSignedRequest(method, uri, params = {}, opts = {}) {
    const nonce = uuid();
    const qs = querystring.stringify(params);
    const fullUrl = `${config.host}${uri}?nonce=${nonce}&apikey=${config.apikey}&${qs}`;
    return Promise.resolve(axios(_.merge({
      method,
      url: fullUrl,
      headers: {
        apisign: createSignature(fullUrl, nonce),
      },
    }, opts)));
  }


  function mapOrderType(orderType) {
    const parts = orderType.split('_');
    if (parts.length !== 2) {
      return {
        type: 'N/A',
        side: 'N/A',
      };
    }
    return {
      type: parts[0].toLowerCase(),
      side: parts[1].toLowerCase(),
    };
  }

  return {
    getHoldings() {
      return makeSignedRequest('GET', '/api/v1.1/account/getbalances')
        .then(resp => resp.data)
        .then(data => {
          if (!data.success)
            throw new Error('Api reported failure');
          return data.result;
        }).map(holding => {
          return {
            currency: holding.Currency,
            balance: holding.Balance,
            available: holding.Available,
            hold: holding.Pending,
            id: `BITTREX-${holding.Currency}`,
          };
        });
    },

    getOrders() {
      return Promise.all([
        makeSignedRequest('GET', '/api/v1.1/account/getorderhistory')
          .then(resp => resp.data.result)
          .map(order => {
            return _.assign({
              status: 'F',
              product: order.Exchange,
              price: order.PricePerUnit || order.Price / order.Quantity,
              size: order.Quantity,
              date: order.TimeStamp,
              fee: order.Commission,
            }, mapOrderType(order.OrderType));
          }),
        makeSignedRequest('GET', '/api/v1.1/market/getopenorders')
          .then(resp => resp.data.result)
          .map(order => {
            return _.assign({
              status: 'O',
              product: order.Exchange,
              price: order.Limit,
              size: order.Quantity,
              date: order.Opened,
              fee: 0,
            }, mapOrderType(order.OrderType));
          }),
      ]).then(_.flatten);
    },

    getMarkets() {
      return Promise.resolve(axios.get(`${config.host}/api/v1.1/public/getmarkets`))
        .then(resp => resp.data.result)
        .map(market => {
          return {
            currency: market.MarketCurrency,
            relation: market.BaseCurrency,
          };
        });
    },

    getTicker(currency, relation) {
      return Promise.resolve(axios.get(`${config.host}/api/v1.1/public/getticker?market=${relation}-${currency}`))
        .then(resp => resp.data)
        .then(ticker => {
          if (!ticker.success)
            throw new Error(`Unable to retrieve ticker for ${relation}-${currency}`);
          return {
            price: ticker.result.Last,
            volume: null,
          };
        });
    },

    createLimitOrder(side, product, size, price) {
      let url = null;
      if (side === 'buy')
        url = '/api/v1.1/market/buylimit';
      else if (side === 'sell')
        url = '/api/v1.1/market/selllimit';

      return makeSignedRequest('GET', url, { market: product, quantity: size, rate: price })
        .then(resp => {
          if (!resp.data.success)
            throw Error(`Failed to create bittrex trade on ${side} ${product}`);
          return { id: resp.data.result.uuid };
        });
    },

    getOrder(orderId) {
      return makeSignedRequest('GET', '/api/v1.1/account/getorder', { uuid: orderId })
        .then(resp => {
          if (!resp.data.success)
            throw Error(`Failed to get bittrex order for ${orderId}`);
          const order = resp.data.result;
          /* eslint no-nested-ternary: off */
          return {
            settled: !order.IsOpen,
            price: order.Limit,
            quantity: order.Quantity,
            product: order.Exchange,
            status: order.IsOpen ? 'O' : (order.QuantityRemaining > 0 ? 'X' : 'F'),
          };
        });
    },

    cancelOrder(orderId) {
      return makeSignedRequest('GET', '/api/v1.1/market/cancel', { uuid: orderId })
        .then(resp => {
          if (!resp.data.success)
            throw Error(`Failed to cancel order ${orderId}`);
          return {};
        });
    },
  };
};

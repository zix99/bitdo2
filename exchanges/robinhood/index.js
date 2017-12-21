const _ = require('lodash');
const axios = require('axios');
const Promise = require('bluebird');
const querystring = require('querystring');

module.exports = (exchangeOpts) => {
  const config = _.merge({
    host: 'https://api.robinhood.com',
  }, exchangeOpts);


  let __token = null;
  function getOrRequestToken() {
    if (__token)
      return Promise.resolve(__token);
    if (config.token)
      return Promise.resolve(__token);
    const qs = querystring.stringify({
      username: config.username,
      password: config.password,
    });
    return axios({
      url: `${config.host}/api-token-auth/`,
      method: 'POST',
      data: qs,
      header: {
        Accept: 'application/json',
      },
    }).then(ret => {
      /* eslint prefer-destructing: off */
      __token = ret.data.token;
      return __token;
    });
  }

  function makeRequest(method, uri) {
    return Promise.resolve(axios({
      url: `${config.host}${uri}`,
      method,
    })).then(resp => resp.data);
  }

  function makeAuthenticatedRequest(method, uri, body) {
    return Promise.resolve(getOrRequestToken())
      .then(token => {
        const url = uri.startsWith('http') ? uri : `${config.host}${uri}`;
        return axios({
          method,
          url,
          data: body,
          headers: {
            Authorization: `Token ${token}`,
          },
        });
      }).then(resp => resp.data);
  }

  function makeAuthenticatedPaginatedRequest(method, uri, body) {
    return makeAuthenticatedRequest(method, uri, body)
      .then(resp => {
        if (resp.next) {
          return makeAuthenticatedPaginatedRequest(method, resp.next, body)
            .then(nextResp => _.flatten(resp.results, nextResp));
        }
        return resp.results || [];
      });
  }

  let __primaryAccount = null;
  function getPrimaryAccount() {
    if (__primaryAccount)
      return Promise.resolve(__primaryAccount);
    return makeAuthenticatedRequest('GET', '/accounts/')
      .then(accounts => accounts.results[0])
      .tap(account => {
        __primaryAccount = account;
      });
  }

  function getStatusFromState(state) {
    switch (state) {
      case 'filled': return 'F';
      case 'rejected': return 'X';
      case 'canceled': return 'X';
      case 'failed': return 'X';
      case 'queued': return 'O';
      case 'unconfirmed': return 'O';
      case 'confirmed': return 'O';
      case 'partially_filled': return 'O';
      default: return '?';
    }
  }

  return {
    getMarkets() {
      return this.getHoldings()
        .map(x => x.currency)
        .then(currencies => _.uniq(currencies))
        .map(currency => ({
          currency,
          relation: 'USD',
        }));
    },

    getTicker(currency, relation) {
      if (relation !== 'USD')
        return Promise.reject();
      return makeRequest('GET', `/quotes/${currency}/`)
        .then(ticker => ({
          price: (parseFloat(ticker.ask_price) + parseFloat(ticker.bid_price)) / 2.0,
          volume: 0,
        })).catch(err => {
          if (err.response.status === 404)
            return null;
          throw err;
        });
    },

    getOrders() {
      return makeAuthenticatedPaginatedRequest('GET', '/orders/')
        .map(order => {
          return makeAuthenticatedRequest('GET', order.instrument)
            .then(instrument => _.merge(order, { instrument }));
        })
        .map(order => ({
          id: order.id,
          status: getStatusFromState(order.state),
          product: `${order.instrument.symbol}-USD`,
          price: parseFloat(order.price || order.average_price),
          size: parseFloat(order.quantity),
          date: order.created_at,
          type: order.type,
          side: order.side,
          fee: parseFloat(order.fees),
        }));
    },

    getHoldings() {
      return getPrimaryAccount()
        .then(account => {
          return makeAuthenticatedPaginatedRequest('GET', account.positions)
            .map(holding => {
              return makeAuthenticatedRequest('GET', holding.instrument)
                .then(instrument => {
                  return _.merge({ inst: instrument }, holding);
                });
            }).map(holding => ({
              id: `RH-${holding.inst.symbol}`,
              currency: holding.inst.symbol,
              balance: parseFloat(holding.quantity),
              available: parseFloat(holding.quantity) - parseFloat(holding.shares_held_for_sells) - parseFloat(holding.shares_held_for_buys),
              hold: parseFloat(holding.shares_held_for_buys) + parseFloat(holding.shares_held_for_sells),
            })).then(holdings => {
              return _.concat(holdings, {
                id: 'RH-USD',
                currency: 'USD',
                balance: account.cash || 0,
                available: account.cash_available_for_withdrawal || 0,
                hold: account.cash_held_for_orders || 0,
              });
            });
        });
    },

    getOrder() {
      return Promise.resolve(null);
    },
  };
};

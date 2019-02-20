const _ = require('lodash');
const axios = require('axios');
const Promise = require('bluebird');
const querystring = require('querystring');

module.exports = (exchangeOpts) => {
  const config = _.merge({
    username: null,
    password: null,
    token: null,
    host: 'https://api.robinhood.com',
  }, exchangeOpts);


  let __token = null;
  function getOrRequestToken() {
    if (__token)
      return Promise.resolve(__token);
    if (config.token)
      return Promise.resolve(config.token);
    const qs = querystring.stringify({
      username: config.username,
      password: config.password,
      grant_type: "password",
      client_id: "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS",
    });
    return axios({
      url: `${config.host}/oauth2/token/`,
      method: 'POST',
      data: qs,
      header: {
        Accept: 'application/json',
      },
    }).then(ret => {
      /* eslint prefer-destructing: off */
      __token = ret.data.access_token;
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
            Authorization: `Bearer ${token}`,
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
      case 'cancelled': return 'X';
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
      return makeAuthenticatedRequest('GET', `/quotes/${currency}/`)
        .then(ticker => ({
          price: (parseFloat(ticker.ask_price) + parseFloat(ticker.bid_price)) / 2.0,
          volume: 0,
        })).catch(err => {
          if (err.response.status === 404)
            return null;
          throw err;
        });
    },

    __getStockOrders() {
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

    __getOptionOrders() {
      return makeAuthenticatedPaginatedRequest('GET', '/options/orders/')
        .map(option => ({
          id: option.id,
          status: getStatusFromState(option.state),
          product: `${option.chain_symbol}-USD`,
          price: parseFloat(option.premium),
          size: parseFloat(option.quantity),
          date: option.created_at,
          type: option.type,
          side: option.opening_strategy,
          fee: parseFloat(option.premium),
        }));
    },

    getOrders() {
      return Promise.all([this.__getStockOrders(), this.__getOptionOrders()])
        .then(_.flatten);
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

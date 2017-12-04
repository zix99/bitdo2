const crypto = require('crypto');
const axios = require('axios');
const uuid = require('uuid/v4');
const Promise = require('bluebird');
const config = require('./config');
const _ = require('lodash');

function createSignature(uri, nonce) {
	const hmac = crypto.createHmac('sha512', config.apisecret);
	return hmac.update(uri).digest('hex');
}

function makeSignedRequest(method, uri, opts) {
	const nonce = uuid();
	const fullUrl = `${config.host}${uri}?nonce=${nonce}&apikey=${config.apikey}`;
	return Promise.resolve(axios(_.merge({
		method,
		url: fullUrl,
		headers: {
			apisign: createSignature(fullUrl, nonce),
		}
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

module.exports = {
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
						price: order.Price,
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
	}
};

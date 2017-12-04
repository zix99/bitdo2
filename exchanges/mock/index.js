const Promise = require('bluebird');

module.exports = {
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
			}
		]);
	},

	getTicker(currency, relation) {
		return Promise.resolve({
			price: 100,
			volume: 1000,
		});
	}
};

const _ = require('lodash');

module.exports = {
  // Parse product in shape EXCHANGE:COIN-RELATION
  parseProduct(product) {
    if (!product)
      throw new Error('Expected parseable product');

    const exParts = product.split(':');
    if (exParts.length === 2)
      return _.assign({ exchange: exParts[0] }, this.parseProduct(exParts[1]));
    if (exParts.length === 1) {
      const coinParts = exParts[0].split('-');
      if (coinParts.length === 1)
        return { symbol: coinParts[0] };
      if (coinParts.length === 2)
        return { symbol: coinParts[0], relation: coinParts[1] };
    }
    throw new Error('Invalid product format');
  },
};

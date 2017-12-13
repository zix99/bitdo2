const Sequelize = require('sequelize');
const log = require('../log');
const _ = require('lodash');

module.exports = (dbUri, opts = {}) => {
  const db = new Sequelize(dbUri, _.merge({
    logging: txt => log.debug(txt),
  }, opts));

  const Holdings = db.define('holdings', {
    exchange: Sequelize.STRING,
    symbol: Sequelize.STRING,
    amount: Sequelize.DOUBLE,
    amountBtc: Sequelize.DOUBLE,
    amountUsd: Sequelize.DOUBLE,
  }, {
    indexes: [
      { fields: ['exchange', 'symbol'] },
      { fields: ['createdAt'] },
    ],
  });

  return {
    db,
    Holdings,
  };
};

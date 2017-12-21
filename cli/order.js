const Exchanges = require('../exchanges');
const config = require('../config');
const Promise = require('bluebird');
const _ = require('lodash');
const chalk = require('chalk');
const columnify = require('columnify');
const moment = require('moment');
const format = require('../lib/format');

function buildExchange(args) {
  return Exchanges.createFromConfig(config.exchanges, { simulate: args.simulate });
}

function cmdList(args) {
  const exchanges = buildExchange(args);

  Promise.map(exchanges, exchange => exchange.getOrders())
    .then(_.flatten)
    .then(orders => {
      let orderSet = args.all ? orders : _.filter(orders, x => x.status === 'O' || x.stauts === '?');

      if (args.status)
        orderSet = _.filter(orderSet, x => x.status === args.status);

      if (args.buys)
        orderSet = _.filter(orderSet, x => x.side === 'buy');

      if (args.sells)
        orderSet = _.filter(orderSet, x => x.side === 'sell');

      return orderSet;
    })
    .then(orders => {
      if (args.json)
        console.log(JSON.stringify(_(orders).map(x => _.omit(x, 'exchange'))));
      else {
        const table = _.map(_.orderBy(orders, x => moment(x.date)), order => ({
          id: chalk.gray(order.id),
          exchange: chalk.yellow(order.exchange.name),
          product: chalk.white(order.product),
          type: order.type,
          side: order.side === 'buy' ? chalk.green(order.side) : chalk.red(order.side),
          status: order.status,
          price: chalk.blue(format.number(order.price)),
          size: chalk.blueBright(format.number(order.size)),
          fee: format.number(order.fee),
        }));
        console.log(columnify(table));
      }
    });
}

exports.command = 'order [command]';
exports.desc = 'Operate on orders, including list, buy, sell, cancel, etc';
exports.builder = args => args
  .describe('simulate', 'Run the order executor as a simulation')
  .boolean('simulate')
  .alias('simulate', 's')
  .command('list', 'Lists orders', x => x
    .describe('all', 'Show all orders')
    .boolean('all')
    .describe('status', 'Show only orders in a given flagged status')
    .string('status')
    .describe('buys', 'Show only buy orders')
    .boolean('buys')
    .describe('sells', 'Show only sell orders')
    .boolean('sells')
    .describe('json', 'Output JSON data')
    .boolean('json'), cmdList)
  .command('buy <product>', 'Executes a buy of a product')
  .command('sell <product>', 'Executes a sell of a product');
exports.handler = cmdList;

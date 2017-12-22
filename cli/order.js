const Exchanges = require('../exchanges');
const config = require('../config');
const Promise = require('bluebird');
const _ = require('lodash');
const chalk = require('chalk');
const columnify = require('columnify');
const moment = require('moment');
const format = require('../lib/format');
const inquirer = require('inquirer');

function buildExchanges(args) {
  return Exchanges.createFromConfig(config.exchanges, { simulate: args.simulate });
}

function colorSide(side) {
  return side === 'buy' ? chalk.green(side) : chalk.red(side);
}

function cmdList(args) {
  const exchanges = buildExchanges(args);

  return Promise.map(exchanges, exchange => exchange.getOrders())
    .then(_.flatten)
    .then(orders => {
      let orderSet = args.all ? orders : _.filter(orders, x => x.status === 'O' || x.stauts === '?');

      if (args.status)
        orderSet = _.filter(orderSet, x => x.status === args.status);

      if (args.buys)
        orderSet = _.filter(orderSet, x => x.side === 'buy');

      if (args.sells)
        orderSet = _.filter(orderSet, x => x.side === 'sell');

      if (args.product)
        orderSet = _.filter(orderSet, x => x.product === args.product);

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
          side: colorSide(order.side),
          status: order.status,
          price: chalk.blue(format.number(order.price)),
          size: chalk.blueBright(format.number(order.size)),
          fee: format.number(order.fee),
        }));
        console.log(columnify(table));
      }
    });
}

function queryForOrder(exchanges, providedId, message = 'Select order') {
  return Promise.map(exchanges, exchange => exchange.getOrders())
    .then(_.flatten)
    .then(orders => _.filter(orders, order => order.status === 'O'))
    .then(orders => {
      if (providedId)
        return _.find(orders, x => x.id === providedId);

      return inquirer.prompt({
        type: 'list',
        name: 'order',
        message,
        choices: _.map(orders, x => ({
          name: `${x.id} ${chalk.yellow(x.exchange.name)} ${x.product} ${colorSide(x.side)} ${chalk.blue(format.number(x.price))} ${chalk.blueBright(format.number(x.size))}`,
          short: x.id,
          value: x,
        })),
      });
    })
    .then(answer => answer.order);
}

function cmdCancel(args) {
  const exchanges = buildExchanges(args);

  return queryForOrder(exchanges, args.id, 'Pick order to cancel')
    .then(order => {
      console.log(`Will cancel ${order.id} ${order.exchange.name} ${order.product}...`);
      return order.exchange.cancelOrder(order.id);
    })
    .then(() => {
      console.log('Order canceled');
    }).catch(err => {
      console.log(`Error canceling order: ${err.message}`);
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
    .describe('product', 'Show only when product matches this string')
    .string('product')
    .describe('json', 'Output JSON data')
    .boolean('json'), cmdList)
  .command('buy <product>', 'Executes a buy of a product')
  .command('sell <product>', 'Executes a sell of a product')
  .command('cancel', 'Cancel an order', x => x
    .describe('id', 'Order id to cancel. If not provided, will be prompted for')
    .string('id'), cmdCancel);
exports.handler = cmdList;

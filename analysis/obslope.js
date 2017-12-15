const parsers = require('../lib/parsers');
const log = require('../log');
const Plugins = require('../plugins');
const Exchanges = require('../exchanges');
const config = require('../config');
const _ = require('lodash');
const Promise = require('bluebird');

log.enableConsole();

exports.command = 'obslope <product>';
exports.desc = 'Runs analysis on the slop of an orderbook of a given product';
exports.builder = args => args
  .describe('poll', 'Number of seconds between polling')
  .number('poll')
  .default('poll', 30)
  .describe('window', 'Percentage to examine relative to ticker price')
  .number('window')
  .default('window', 0.2);

exports.handler = (args) => {
  const product = parsers.parseProduct(args.product);

  log.info(`Starting up orderbook analyzer on ${product.exchange} ${product.symbol}`);
  const exchange = Exchanges.createExchange(product.exchange, config.exchanges[product.exchange]);

  const plugins = Plugins.createFromConfig({
    web: {
      port: 8081,
    },
  });

  function createGraphData(book) {
    return _.reduce(book, (graph, item) => {
      const prevSize = graph.length > 0 ? graph[graph.length - 1].y : 0;
      graph.push({
        x: item.price,
        y: prevSize + item.size,
      });
      return graph;
    }, []);
  }

  function update() {
    log.info('Updating OB analysis...');
    return Promise.all([
      exchange.getOrderBook(product.symbol, product.relation, 1),
      exchange.getTicker(product.symbol, product.relation),
    ]).spread((orderbook, ticker) => {
      plugins.graph(`${product.symbol}-${product.relation} Orderbook`, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Buys',
            steppedLine: 'before',
            backgroundColor: 'rgba(0,255,0,0.3)',
            borderColor: 'rgba(0,255,0,0.8)',
            fill: true,
            pointRadius: 0,
            data: createGraphData(_.reverse(_.filter(orderbook.buys, buy => buy.price > ticker.price - ticker.price * args.window))),
          }, {
            label: 'Sells',
            steppedLine: 'after',
            backgroundColor: 'rgba(255,0,0,0.3)',
            borderColor: 'rgba(255,0,0,0.8)',
            fill: true,
            pointRadius: 0,
            data: createGraphData(_.filter(orderbook.sells, buy => buy.price < ticker.price + ticker.price * args.window)),
          }],
        },
        options: {
          stacked: false,
          scales: {
            xAxes: [{
              type: 'linear',
              ticks: {
                source: 'labels',
                minRotation: 30,
                autoSkip: true,
              },
            }],
          },
        },
        html: {
          width: '100%',
        },
      });
    });
  }
  update();
  setInterval(update, args.poll * 1000);
};

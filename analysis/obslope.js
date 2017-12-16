const parsers = require('../lib/parsers');
const log = require('../log');
const Plugins = require('../plugins');
const Exchanges = require('../exchanges');
const config = require('../config');
const moment = require('moment');
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

  function discoverOrderbookWalls(book, wallThreshold = 2.5) {
    const walls = [];

    // "Center" of the book
    walls.push({
      price: book[0].price,
      size: book[0].size,
      slope: 0,
    });

    let ema = book[0].size * 5;
    let net = book[0].size;
    _.each(book, order => {
      net += order.size;
      if (order.size >= ema * wallThreshold) {
        walls.push({
          price: order.price,
          size: net,
          slope: 0,
        });
        walls[walls.length - 2].slope = (net - walls[walls.length - 2].size) / (order.price - walls[walls.length - 2].price) / 100;
      }
      ema = (ema * 3 + order.size) / 4;
    });

    return walls;
  }

  const priceHistory = [];
  function update() {
    log.info('Updating OB analysis...');
    return Promise.all([
      exchange.getOrderBook(product.symbol, product.relation, 1),
      exchange.getTicker(product.symbol, product.relation),
    ]).spread((orderbook, ticker) => {
      priceHistory.push({ price: ticker.price, ts: new Date() });

      const windowedBuys = _.filter(orderbook.buys, buy => buy.price > ticker.price - ticker.price * args.window);
      const windowedSells = _.filter(orderbook.sells, buy => buy.price < ticker.price + ticker.price * args.window && buy.price > 0);

      const buyWalls = discoverOrderbookWalls(_.reverse(_.clone(windowedBuys)));
      const sellWalls = discoverOrderbookWalls(windowedSells);

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
            data: createGraphData(_.reverse(windowedBuys)),
          }, {
            label: 'Sells',
            steppedLine: 'before',
            backgroundColor: 'rgba(255,0,0,0.3)',
            borderColor: 'rgba(255,0,0,0.8)',
            fill: true,
            pointRadius: 0,
            data: createGraphData(windowedSells),
          }, {
            label: 'Buy-Walls',
            pointRadius: 10,
            pointStyle: 'triangle',
            fill: false,
            backgroundColor: 'white',
            borderColor: 'rgba(255,255,255,0.5)',
            lineTension: 0,
            data: _.map(buyWalls, item => ({
              x: item.price,
              y: item.size,
              text: `y=${~~item.slope}`,
            })),
          }, {
            label: 'Sell-Walls',
            pointRadius: 10,
            pointStyle: 'triangle',
            fill: false,
            backgroundColor: 'white',
            borderColor: 'rgba(255,255,255,0.5)',
            lineTension: 0,
            data: _.map(sellWalls, item => ({
              x: item.price,
              y: item.size,
              text: `y=${~~item.slope}`,
            })),
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

      plugins.graph(`${product.symbol}-${product.relation} Ticker`, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Price',
            data: _.map(priceHistory, h => ({ x: moment(h.ts).format(), y: h.price })),
            backgroundColor: 'rgba(255,255,255,0.7)',
            pointRadius: 0,
          }],
        },
        options: {
          scales: {
            xAxes: [{
              type: 'time',
              distribution: 'series',
              ticks: {
                source: 'labels',
                minRotation: 30,
                autoSkip: true,
              },
              time: {
                tooltipFormat: 'll HH:mm',
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

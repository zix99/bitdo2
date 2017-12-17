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

  function discoverOrderbookWalls(currentPrice, book, wallThreshold = 2, slopeAdjustor = 100.0, ignoreEarlyPrice = 0.01, smalength = 50) {
    const walls = [];

    // "Center" of the book
    walls.push({
      price: book[0].price,
      size: book[0].size,
      slope: 0,
    });

    const sma = [0];
    let net = book[0].size;
    _.each(book, order => {
      net += order.size;
      if (order.size >= _.mean(sma) * wallThreshold && Math.abs(order.price - currentPrice) > currentPrice * ignoreEarlyPrice) {
        walls.push({
          price: order.price,
          size: net,
          slope: 0,
        });
        walls[walls.length - 2].slope = Math.abs((net - walls[walls.length - 2].size) / (order.price - walls[walls.length - 2].price)) / slopeAdjustor;
      }
      if (order.size > _.mean(sma) * 0.9)
        sma.push(order.size);
      while (sma.length > smalength) sma.shift();
    });

    return walls;
  }

  const outstandingOrders = [];
  const priceHistory = [];
  let velocity = 0;
  const velocitySMA = [];
  let lastPrice = null;
  const velocityPeriods = 15;
  let currentBuy = null;
  function update() {
    log.info('Updating OB analysis...');
    return Promise.all([
      exchange.getOrderBook(product.symbol, product.relation, 1),
      exchange.getTicker(product.symbol, product.relation),
    ]).spread((orderbook, ticker) => {
      priceHistory.push({ price: ticker.price, ts: new Date() });

      const windowedBuys = _.filter(orderbook.buys, buy => buy.price > ticker.price - ticker.price * args.window);
      const windowedSells = _.filter(orderbook.sells, buy => buy.price < ticker.price + ticker.price * args.window && buy.price > 0);

      const buyWalls = discoverOrderbookWalls(ticker.price, _.reverse(_.clone(windowedBuys)));
      const sellWalls = discoverOrderbookWalls(ticker.price, windowedSells);

      /*
      Basic algorithm thoughts:
      - If volume velocity is sufficiently high enough
      - If going-right has a SUFFICIENTLY lower slope than going left (aka, favoring buys)
      - If it has well-defined walls
      - Add a buy order right after the first wall, and a sell right before the one after
      */

      // TODO: Right now just using price as velocity, but should really be volume
      velocitySMA.push(ticker.price - (lastPrice || ticker.price));
      while (velocitySMA.length > velocityPeriods)
        velocitySMA.shift();
      lastPrice = ticker.price;
      velocity = _.mean(velocitySMA);

      const slopeModifier = 2;
      if (buyWalls.length >= 2 && sellWalls.length >= 3
        && buyWalls[0].slope < sellWalls[0].slope * slopeModifier
        && velocity > ticker.price * 0.002
        && !currentBuy) {
        const buyPrice = sellWalls[1].price + 0.12;
        log.info(`Triggering expected buy at ${buyPrice}`);
        currentBuy = {
          price: buyPrice,
          size: 5,
        };
        outstandingOrders.push(currentBuy);
      }

      if (currentBuy) {
        // Watch the buy price, and the walls, as they may be adjusting
        // A) Update sell to change price
        // B) Immediate sell in risky situations (or cancel the buy if not settled)
      }

      /*
      Display graph to user
      */
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
            yAxisID: 'y-axis-1',
          }, {
            label: 'Sells',
            steppedLine: 'before',
            backgroundColor: 'rgba(255,0,0,0.3)',
            borderColor: 'rgba(255,0,0,0.8)',
            fill: true,
            pointRadius: 0,
            data: createGraphData(windowedSells),
            yAxisID: 'y-axis-1',
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
            yAxisID: 'y-axis-1',
          }, {
            label: 'Sell-Walls',
            pointRadius: 10,
            pointHoverRadius: 15,
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
            yAxisID: 'y-axis-1',
          }, {
            label: 'Velocity',
            pointRadius: 10,
            pointHoverRadius: 15,
            fill: false,
            borderColor: 'rgba(255,255,255,0.5)',
            lineTension: 0,
            data: [{
              x: ticker.price,
              y: 0,
              text: `v=${velocity}`,
            }, {
              x: ticker.price + velocity,
              y: 0,
            }],
            yAxisID: 'y-axis-2',
          }, {
            label: 'Orders',
            pointRadius: 10,
            pointHoverRadius: 15,
            pointStyle: 'star',
            fill: false,
            showLine: false,
            data: _.map(outstandingOrders, order => ({
              x: order.price,
              y: order.size,
            })),
            yAxisID: 'y-axis-2',
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
            yAxes: [{
              type: 'linear',
              display: true,
              position: 'left',
              id: 'y-axis-1',
            }, {
              type: 'linear',
              display: true,
              position: 'right',
              id: 'y-axis-2',
              gridLines: {
                drawOnChartArea: false,
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

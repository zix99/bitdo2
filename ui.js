#!/usr/bin/env node
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const moment = require('moment');
const _ = require('lodash');
const Exchange = require('./exchanges');
const config = require('./config');
const log = require('./log');
const format = require('./lib/format');
const MethodTransport = require('./lib/methodtransport');
const Promise = require('bluebird');
const HoldingsService = require('./services/holdings');

log.overrideConsole();

/* eslint arrow-body-style: off */

const screen = blessed.Screen({
  smartCSR: true,
});

const header = blessed.Text({
  top: 0,
  left: '70%+1',
  width: '40%-2',
  height: 1,
  content: 'BitDo2',
});
screen.append(header);

const clock = blessed.Text({
  left: '100%-14',
  width: 14,
  height: 1,
});
screen.append(clock);

const holdingTable = contrib.table({
  keys: true,
  width: '70%',
  height: '50%',
  interactive: true,
  label: 'Holdings',
  columnWidth: [10, 10, 6, 12, 12, 12, 12, 12, 12, 8],
  columnSpacing: 4,
  border: {
    type: 'line',
  },
  fg: 'white',
});
screen.append(holdingTable);

const orderTable = blessed.ListTable({
  width: '70%',
  height: '50%',
  top: '50%',
  border: {
    type: 'line',
  },
  style: {
    header: {
      bold: true,
      bg: 'blue',
    },
  },
});
screen.append(orderTable);

const logpanel = blessed.Log({
  width: '30%',
  height: '100%-1',
  left: '70%',
  top: 1,
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: '#f0f0f0',
    },
  },
  tags: true,
  scrollback: 10000,
  label: 'Log Messages',
});
screen.append(logpanel);


// Scren methods and control

// Clock ticker
setInterval(() => {
  clock.content = chalk.cyan(moment().format('LTS'));
  screen.render();
}, 1000);

screen.key(['C-c'], () => {
  process.exit(0);
});

log.add(MethodTransport, {
  cb: msg => {
    logpanel.log(msg);
    screen.render();
  },
});

// Processing and display

function directionalColor(val) {
  if (val > 0.0)
    return chalk.greenBright;
  if (val < 0.0)
    return chalk.redBright;
  return chalk.yellow;
}


// Set up exchanges
const exchanges = Exchange.createFromConfig(config.exchanges);
const holdingsService = new HoldingsService(exchanges);

const HOLDING_DELTA_HISTORY = {};

function updateHoldings() {
  log.info('Updating holdings...');
  return holdingsService.getHoldings()
    .then(holdings => _.orderBy(holdings, h => h.conversions.USD, 'desc'))
    .then(holdings => {
      const sums = { BTC: 0, USD: 0 };
      const data = _.map(holdings, v => {
        const key = `${v.exchange.name}:${v.currency}`;
        HOLDING_DELTA_HISTORY[key] = (_.get(HOLDING_DELTA_HISTORY, key, v.conversions.USD) + v.conversions.USD) / 2.0;
        const delta = v.conversions.USD - HOLDING_DELTA_HISTORY[key];
        sums.BTC += v.conversions.BTC;
        sums.USD += v.conversions.USD;
        return [
          moment(v.updatedAt).format('Do hA'),
          v.exchange.name,
          v.currency,
          v.ticker.BTC ? format.number(v.ticker.BTC) : '',
          chalk.yellow(format.number(v.ticker.USD)),
          chalk.bold.blueBright(format.number(v.balance)),
          format.number(v.hold),
          format.number(v.conversions.BTC),
          chalk.blue(format.number(v.conversions.USD)),
          directionalColor(delta)(format.number(delta)),
        ];
      });
      data.unshift([]);
      data.unshift(['', 'Total', '', '', '', '', '', format.number(sums.BTC), format.number(sums.USD)]);

      holdingTable.setData({
        headers: ['Updated', 'Exch', 'Sym', 'BTC', 'Last USD', 'Owned', 'Hold', 'BTC', 'USD', 'EMA-D'],
        data,
      });
      screen.render();
    })
    .catch(err => {
      log.error(err.message);
    });
}

function updateOrders() {
  log.info('Updating orders...');
  return Promise.map(exchanges, exchange => exchange.getOrders())
    .then(_.flatten)
    .then(orders => {
      const rows = _.flatten([
        _.map(_.orderBy(_.filter(orders, x => x.status === 'O'), x => x.date, 'desc'), order => {
          return [
            order.status,
            moment(order.date).format('M/D H:mm'),
            order.exchange.name,
            order.product,
            order.side,
            order.type,
            format.number(order.size),
            format.number(order.price),
            'N/A',
          ];
        }),
        [[]],
        _.map(_.orderBy(_.filter(orders, x => x.status !== 'O'), x => x.date, 'desc'), order => {
          return [
            order.status,
            moment(order.date).format('M/D H:mm'),
            order.exchange.name,
            order.product,
            order.side,
            order.type,
            format.number(order.size),
            format.number(order.price),
            format.number(order.fee),
          ];
        }),
      ]);
      rows.unshift(['', 'Created', 'Exchange', 'Product', 'Side', 'Type', 'Size', 'Exec Price', 'Fee']);
      orderTable.setData(rows);
      screen.render();
    })
    .catch(err => {
      log.error(err.message);
    });
}


// Update
let isUpdating = false;
function update() {
  if (isUpdating) {
    log.warn('Already updating, will not update again');
    return;
  }
  isUpdating = true;

  Promise.all([
    updateHoldings(),
    updateOrders(),
  ]).then(() => {
    log.info('Update complete');
  }).catch(err => {
    log.warn(`Error updating: ${err.message}`);
  }).finally(() => {
    isUpdating = false;
  });
}
setInterval(() => {
  update();
}, 60000);
update();

screen.key(['f5', 'r'], update);

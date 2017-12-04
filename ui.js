#!/usr/bin/env node
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const moment = require('moment');
const _ = require('lodash');
const Exchange = require('./exchanges');
const config = require('./config');
const log = require('./log');
const MethodTransport = require('./lib/methodtransport');

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
  columnWidth: [10, 8, 4, 12, 12, 12, 12, 12, 8],
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
const exchanges = _.map(config.exchanges, (exchangeConfig, key) => {
  log.info(`Initializing exchange ${key}...`);
  return Exchange.createExchange(key, exchangeConfig);
});


// Update
setInterval(() => {
  _.each(exchanges, exchange => {

  });
}, 60000);

const parsers = require('../lib/parsers');
const log = require('../log');
const Plugins = require('../plugins');

log.enableConsole();

exports.command = 'obslope <product>';
exports.desc = 'Runs analysis on the slop of an orderbook of a given product';
exports.builder = args => args
  .describe('poll', 'Number of seconds between polling')
  .number('poll')
  .default('poll', 30);

exports.handler = (args) => {
  const product = parsers.parseProduct(args.product);

  log.info(`Starting up orderbook analyzer on ${product.exchange} ${product.symbol}`);

  const plugins = Plugins.createFromConfig({
    web: {
      port: 8081,
    },
  });

  function update() {
    log.info('Updating OB analysis...');
  }
  update();
  setInterval(update, args.poll * 1000);
};

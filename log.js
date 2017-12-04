const winston = require('winston');
const ui = require('./ui')
const MethodTransport = require('./lib/methodtransport');
const config = require('./config');

const log = new (winston.Logger)({
  level: config.verbose ? 'debug' : 'info',
  handleExceptions: false,
  transports: [
    new MethodTransport(ui.log),
    new (winston.transports.File)({
      filename: config.log,
      maxsize: 1024 * 1024 * 10,
      json: false,
      tailable: true,
      zippedArchive: true,
    }),
  ],
});

if (!config.noredirect) {
  console.log = function(txt) {
  	log.info(txt);
  };

  console.dir = function(obj) {
  	log.debug(JSON.stringify(obj));
  }

  console.err = function(txt) {
    log.error(txt);
  }
}

module.exports = log;
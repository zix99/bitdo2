const winston = require('winston');
const config = require('./config');

const log = new (winston.Logger)({
  level: config.verbose ? 'debug' : 'info',
  handleExceptions: false,
  transports: [
    new (winston.transports.File)({
      filename: config.log || 'bitdo2.log',
      maxsize: 1024 * 1024 * 10,
      json: false,
      tailable: true,
      zippedArchive: true,
    }),
  ],
});

if (!config.noredirect) {
  /* eslint no-console: off */
  console.log = function consoleLog(txt) {
    log.info(txt);
  };

  console.dir = function consoleDir(obj) {
    log.debug(JSON.stringify(obj));
  };

  console.error = function consoleError(txt) {
    log.error(txt);
  };
}

module.exports = log;

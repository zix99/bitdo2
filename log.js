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

log.enableConsole = function enableConsole(level = 'debug') {
  if (log.__enabledConsole)
    return log;

  log.__enabledConsole = true;
  log.add(winston.transports.Console, {
    colorize: true,
    timestamp: true,
    prettyPrint: true,
    level,
  });
  return log;
};

log.overrideConsole = function overrideConsole() {
  /* eslint no-console: off */
  console.log = function consoleLog(txt) {
    log.info(txt);
  };
  console.dir = function consoleDir(obj) {
    log.debug(JSON.stringify(obj));
  };
  console.err = function consoleError(txt) {
    log.err(txt);
  };
};

module.exports = log;

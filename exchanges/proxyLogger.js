const _ = require('lodash');
const log = require('../log');

module.exports = (impl) => new Proxy(impl, {
  get(obj, prop) {
    const o = obj[prop];
    log.debug(`Get ${obj.name}::${prop}`);
    if (_.isFunction(o)) {
      return (...args) => {
        log.debug(`Invoking ${obj.name}::${prop}`);
        return o.apply(obj, args);
      };
    }
    return o;
  },
});

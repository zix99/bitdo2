const fs = require('fs');
const Promise = require('bluebird');
const log = require('../log');
const _ = require('lodash');

class Plugin {
  constructor(name, impl) {
    this._name = name;
    this._impl = impl;
  }

  get name() {
    return this._name;
  }

  _call(funcName, ...args) {
    const remote = _.get(this._impl, funcName);
    if (!remote)
      return Promise.resolve(); // Always delegate successfully a non-resolving implementation
    return Promise.resolve(remote.apply(this._impl, args));
  }

  /* Draw a graph
  key: unique identifier for graph
  data: graph drawing payload in format of chartjs
  */
  graph(key, data) {
    return this._call('graph', key, data);
  }

  /* Remove and no longer draw a graph
  key: the unique key
  */
  deleteGraph(key) {
    return this._call('deleteGraph', key);
  }
}

function isPromise(o) {
  return _.isObject(o) && _.isFunction(o.then);
}

const PluginLogProxy = impl => new Proxy(impl, {
  get(obj, prop) {
    const o = _.get(obj, prop);
    if (_.isFunction(o)) {
      log.debug(`Plugin invoking ${impl.name}::${prop}`);
      return (...args) => {
        const ret = o.apply(obj, args);
        if (isPromise(ret)) {
          ret.then((...pret) => {
            if (pret.length > 0)
              log.debug(`  Plugin invoke ${impl.name}::${prop} returned:\n  ${pret}`);
          });
        } else if (ret !== undefined)
          log.warn(`Plugin method ${impl.name}::${prop} did not return a promise!`);
        return ret;
      };
    }
    return o;
  },

  set() {
    return false;
  },
});

const PluginSet = implArr => new Proxy(implArr, {
  get(objArr, prop) {
    const retArr = _(objArr).map(obj => ({ obj, val: obj[prop] })).filter(x => !!x.val).value();
    if (_.every(retArr, x => _.isFunction(x.val))) {
      // Wrap to a new function
      // A call to this function will result in the call to every underlying function
      return (...args) => {
        return Promise.all(_.map(retArr, x => x.val.apply(x.obj, args)));
      };
    }
    return retArr;
  },

  set() {
    return false;
  },

  apply() {
    throw new Error('Not implemented');
  },
});

/* eslint global-require: off */
/* eslint import/no-dynamic-require: off */
function requirePlugin(name, config) {
  if (fs.existsSync(`${__dirname}/${name}`))
    return require(`./${name}`)(config);
  if (fs.existsSync(`${__dirname}/${name}.js`))
    return require(`./${name}.js`)(config);
  return require(`bitdo-plugin-${name}`)(config);
}

module.exports = {
  createPlugin(name, config, opts = {}) {
    let plugin = requirePlugin(name, config);
    plugin.name = name.toUpperCase();
    if (opts.log || config.log) {
      log.info(`Instatiating plugin ${name}...`);
      plugin = PluginLogProxy(plugin);
    }
    return new Plugin(name, plugin);
  },

  // Create a set of plugins with separate configs
  createFromConfig(configSet, opts = {}) {
    return PluginSet(_.map(configSet, (config, key) => this.createPlugin(key, config, opts)));
  },
};

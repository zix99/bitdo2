# BitDo2

[![Build Status](https://travis-ci.org/zix99/bitdo2.svg?branch=master)](https://travis-ci.org/zix99/bitdo2)
[![npm](https://img.shields.io/npm/v/bitdo2.svg)](https://www.npmjs.com/package/bitdo2)
[![npm](https://img.shields.io/npm/l/bitdo2.svg)](https://www.npmjs.com/package/bitdo2)

> NOTE: BitDo2 is still under development, and can't execute rules quite yet.  It can display and track your holding history to a local database.  Please wait a little bit longer until it can execute rules.

A cryptocurrency automated trader (not an intelligent trader!) and set of utilities.

The intention of this is to provide a configurable platform for performing
automated trades at preset points.

## Installing

Make sure to use at least node 6.x. You can always find the version of node I'm using in the [.nvmrc](.nvmrc) file.

If you get an error about installing/loading the exchanges or plugins, make sure you're running an up-to-date version of `npm`. You
can update npm by running `npm update -g npm`.

```bash
npm install -g bitdo2
```

## Configuration

You will need a file `bitdo.conf` that contains your exchange configuration.

It should look something like this (Fill in your own secrets):
```yaml
exchanges:
  gdax:
    passphrase: xxx
    key: yyy
    b64secret: zzz
  bittrex:
    apikey: www
    apisecret: ddd
  robinhood:
    username: xxx
    password: yyy
verbose: false
```

# Usage

Along with being a platform library, there are several utilities you can use that ship with bitdo2.

## Using as a Library

By default, you can use bitdo2 as a library in your own applications.  It exports the common exchange abstraction,
so you can operate on various exchanges without having to worry about their specific APIs.

eg.
```js
const bitdo2 = require('bitdo2');
bitdo2.createExchange('gdax', {... config ...});

OR

bitdo2.createFromConfig({
  gdax: {
    ...
  },
  bittrex: {
    ...
  }
});
```

## UI

Run: `bitdo-ui`

Make sure you have configuration in the current directory.

You will be presented with a UI showing your current holdings and orders.

## Order

Run: `bitdo-order --help`

This allows you to execute buy/sell/trail orders via command line on any configured exchanges.

**DO SO AT YOUR OWN RISK!**

## Recorder

Run: `bitdo-recorder`

This will (by default) poll your holdings in exchanges and write them to a sqlite DB so you can track them over time.

Uses *Sequelize* to write to DB, so can use any database it supports (mysql, postgres, etc)

# Plugins

There are two abstracted parts of bitdo2 that support plugins: *exchanges* and *plugins*

## Exchanges

Although bitdo2 comes with a set of exchanges builtin (though internally, they're just plugins), you
can extend this by creating a global package (or installing a global package) with the name `bitdo-exchange-XXX`,
where `XXX` is the name of your exchange.

When loading, bitdo will search for a local exchange first, and if one is not found, will check the global
packages.

If you want to implement a new exchange, look at the [plugin constract](exchanges/index.js) for required
methods and contracts.

## Plugins

Some pieces of bitdo use plugins to extend the application without needing to pull the dependencies into
the main app.

Similar to the exchange, these plugins will first be loaded internally, and then searched for in the global
node modules with the pattern `bitdo-plugin-XXX`.

To develop a plugin look at [plugin contract](plugins/index.js)

# License

Copyright (c) 2017 Christopher LaPointe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


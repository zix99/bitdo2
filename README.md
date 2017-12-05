# BitDo2

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
verbose: false
```

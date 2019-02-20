#!/usr/bin/env node
const axios = require('axios');
const querystring = require('querystring');
const args = require('minimist')(process.argv.slice(2));

/*
Helper to create a token by logging in with username and password

Token can be used in configuration rather than password
*/

const config = {
	host: 'https://api.robinhood.com',
};

if (!args.username || !args.password) {
  console.error('Expected --username and --password flags');
  process.exit(1);
}

const qs = querystring.stringify({
  username: args.username,
  password: args.password,
  grant_type: "password",
  client_id: "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS",
});
return axios({
  url: `${config.host}/oauth2/token/`,
  method: 'POST',
  data: qs,
  header: {
    Accept: 'application/json',
  },
}).then(ret => {
  /* eslint prefer-destructing: off */
  console.error('Your token is;');
  console.log(ret.data.access_token);
}).catch(err => {
  console.error(err.message);
});

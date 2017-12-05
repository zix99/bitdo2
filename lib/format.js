const numeral = require('numeral');

const NUMF = '0,0.0000';
const WHOLE_NUM = '0,0';

/* eslint prefer-template: off */

module.exports = {
  number(n, fmt = NUMF) {
    if (Math.abs(n) < 0.000000001)
      return '0.0';
    if (Math.abs(n) < 0.001)
      return 's' + numeral(n * 100000000).format(WHOLE_NUM);
    return numeral(n || 0).format(fmt);
  },

  short(n) {
    return this.number(n, '0,0.##');
  },
};

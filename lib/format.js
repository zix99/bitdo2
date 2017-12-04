const numeral = require('numeral');

const NUMF = "0,0.0000";

module.exports = {
	number(n, fmt) {
		if (Math.abs(n) < 0.000000001)
			return '0.0';
		if (Math.abs(n) < 0.00001)
			return '~0';
		return numeral(n || 0).format(fmt || NUMF);
	},

	short(n) {
		if (Math.abs(n) < 0.000000001)
			return '0.0';
		if (Math.abs(n) < 0.00001)
			return '~0';
		return numeral(n || 0).format('0,0.##');
	}
}

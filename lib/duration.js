const moment = require('moment');

module.exports = function(a,b) {
	return moment.duration(a,b);
};

// Return a moment.duration from a time-string (eg. "1h", "2d")
module.exports.parse = function parse(str) {
	const last = str[str.length - 1];
	return moment.duration(parseInt(str.substr(0, str.length-1)), last);
};


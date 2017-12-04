const fs = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');


const lib = {
	load(filename) {
		return lib.smartParse(fs.readFileSync(filename, 'utf-8'));
	},

	save(filename, obj) {
		fs.writeFileSync(filename, lib.dump(obj));
	},

	smartParse(str) {
		try {
			if (str[0] === '{' || str[0] === '[') {
				// Likely JSON
				return _.assign(JSON.parse(str), {__type: 'json'});
			}
			return _.assign(yaml.safeLoad(str), {__type: 'yaml'});
		} catch(err) {
			console.err(`Error parsing data: ${err.message}`);
			throw err;
		}
	},

	dump(obj) {
		const type = obj.__type || 'json';
		const data = _.omit(obj, ['__type']);
		switch(type) {
			case 'yaml':
				return yaml.safeDump(data);
			case 'json':
			default:
				return JSON.stringify(data, null, '\t');
		}
	},
};

module.exports = lib;

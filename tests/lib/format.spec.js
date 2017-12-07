const format = require('../../lib/format');
const assert = require('chai').assert;

describe('#format', () => {
  it('should format normal number', () => {
    assert.equal(format.number(123.456), '123.4560');
  });
  it('should format a small number', () => {
    assert.equal(format.number(0.0000022), 's220');
  });
  it('should return short formatted number', () => {
    assert.equal(format.short(22.123456), '22.12');
  });
});

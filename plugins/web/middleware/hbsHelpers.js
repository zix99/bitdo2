
/* eslint no-unused-vars: off, no-multi-assign: off, no-param-reassign: off */

module.exports = hbs => {
  const blocks = {};

  // Extend a defined block
  // eg. {{#extend "head"}}code{{/extend}}
  hbs.registerHelper('extend', (name, context) => {
    let block = blocks[name];
    if (!block)
      blocks[name] = block = [];

    block.push(context.fn(this));
  });

  // Define a block that can be extended via extend
  // eg: {{{block "head"}}}
  hbs.registerHelper('block', (name, context) => {
    const blockSet = (blocks[name] || []);
    if (context.fn)
      blockSet.push(context.fn(this));
    const val = blockSet.join('\n');
    blocks[name] = [];
    return val;
  });

  // Make a given NAMED section only appear once
  // To prevent duplicate code
  hbs.registerHelper('once', (name, context) => {
    if (!context.data.defines)
      context.data.defines = {};

    if (!context.data.defines[name]) {
      context.data.defines[name] = true;
      return context.fn(this);
    }
    return '';
  });
};

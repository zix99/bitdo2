const _ = require('lodash');

module.exports = (Chart) => {
  Chart.plugins.register({
    id: 'annotations',
    afterDatasetsDraw: (chart) => {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        if (!meta.hidden) {
          const config = _.assign({
            color: 'white',
            size: 12,
            style: 'normal',
            font: 'Helvetica Neue',
            padding: 5,
          }, _.get(chart, 'config.config.plugins.annotations', {}));

          meta.data.forEach((element, eleIndex) => {
            const idata = dataset.data[eleIndex];
            if (_.isPlainObject(idata) && idata.text) {
              ctx.fillStyle = config.color;
              ctx.font = Chart.helpers.fontString(config.size, config.style, config.font);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              const position = element.tooltipPosition();
              ctx.fillText(`${idata.text}`, position.x, position.y - config.size / 2 - config.padding);
            }
          });
        }
      });
    },
  });
};

const io = require('socket.io-client').connect();
const _ = require('lodash');

const graphs = {};

const container = document.getElementById('graphs');

const CHARTJS_DARK = {
  options: {
    legend: {
      labels: {
        fontColor: 'white',
      },
    },
    title: {
      fontColor: 'white',
    },
    scales: {
      yAxes: [{
        gridLines: {
          color: 'rgba(255,255,255,0.2)',
        },
      }],
    },
  },
};

io.on('graph', ({ key, data }) => {
  console.log(`Updating ${key}`);

  if (!_.has(graphs, key)) {
    console.log(`Generating new chart with key ${key}`);
    const ele = document.createElement('canvas');
    ele.className = 'graph';

    container.appendChild(ele);
    const chart = new Chart(ele.getContext('2d'), _.merge({
      type: 'bar',
      options: {
        title: {
          display: true,
          text: key,
        },
        responsive: true,
        legend: {
          position: 'top',
        },
      },
    }, CHARTJS_DARK, data));
    graphs[key] = {
      chart,
      ele,
    };
  } else {
    const { chart } = graphs[key];
    _.merge(chart, data);
    chart.update();
  }
});

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

let bootVersion = null;
io.on('hello', payload => {
  if (!bootVersion) {
    bootVersion = payload.boot;
    console.log(`Set version to ${bootVersion}`);
  } else if (bootVersion !== payload.boot) {
    console.log('Refreshing page, outdated version');
    window.location.reload();
  }
});

io.on('graph', ({ key, data }) => {
  console.log(`Updating ${key}`);

  if (!_.has(graphs, key)) {
    console.log(`Generating new chart with key ${key}`);
    const eleContainer = document.createElement('div');
    eleContainer.className = 'graph';
    container.appendChild(eleContainer);

    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', '30%');
    eleContainer.appendChild(canvas);

    const chart = new Chart(canvas.getContext('2d'), _.merge({
      type: 'bar',
      options: {
        title: {
          display: true,
          text: key,
        },
        responsive: true,
        legend: {
          position: 'bottom',
          display: false,
        },
      },
    }, CHARTJS_DARK, data));
    graphs[key] = {
      chart,
      canvas,
    };
  } else {
    const { chart } = graphs[key];
    _.merge(chart, data);
    chart.update();
  }
});

io.on('deleteGraph', ({ key }) => {
  if (_.has(graphs, key)) {
    graphs[key].chart.destroy();
    graphs[key].canvas.remove();
    delete graphs[key];
  }
});

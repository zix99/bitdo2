const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    chart: './client/js/chart.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/js'),
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader',
        query: {
          presets: ['env'],
        },
      },
    ],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
    }),
  ],
};

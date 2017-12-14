#!/usr/bin/env node
const express = require('express');
const log = require('winston');
const path = require('path');
const hbs = require('hbs');
const http = require('http');
const socketio = require('socket.io');
const _ = require('lodash');
require('./middleware/hbsHelpers')(hbs);

const BOOT_DATE = ~~new Date();

const GRAPHS = {};

module.exports = (context = {}) => {
  const PORT = context.port || 8080;

  const app = express();
  const server = http.Server(app);
  const io = socketio(server);
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'hbs');

  app.use(express.static(path.join(__dirname, 'dist')));
  hbs.registerPartials(`${__dirname}/views/partials`);

  io.on('connection', (sock) => {
    log.info('Socket connected');
    sock.emit('hello', {
      boot: BOOT_DATE,
    });
    _.each(GRAPHS, (data, key) => {
      io.emit('graph', { key, data });
    });
  });

  app.get('/', (req, res) => {
    res.redirect('/charts');
  });

  app.get('/charts', (req, res) => {
    res.render('charts');
  });

  server.listen(PORT, () => {
    log.info(`Web plugin started on port ${PORT}: http://localhost:${PORT}`);
  });

  return {
    graph(key, data) {
      GRAPHS[key] = data;
      io.emit('graph', { key, data });
    },

    deleteGraph(key) {
      delete GRAPHS[key];
      io.emit('deleteGraph', { key });
    },
  };
};

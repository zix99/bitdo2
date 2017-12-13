#!/usr/bin/env node
const express = require('express');
const log = require('winston');
const path = require('path');
const hbs = require('hbs');
const http = require('http');
const socketio = require('socket.io');
require('./middleware/hbsHelpers')(hbs);

module.exports = context => {
  const PORT = context.port || 8080;

  const app = express();
  const server = http.Server(app);
  const io = socketio(server);
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'hbs');

  app.use(express.static(path.join(__dirname, 'dist')));
  hbs.registerPartials(`${__dirname}/views/partials`);

  io.on('connection', () => {
    log.info('Socket connected');
  });

  app.get('/', (req, res) => {
    res.redirect('/charts');
  });

  app.get('/charts', (req, res) => {
    res.render('charts');
  });

  server.listen(PORT, () => {
    log.info(`Web plugin started on port ${PORT}`);
  });

  return {
    pushData(key, data) {
      io.emit('graph', { key, data });
    },
  };
};

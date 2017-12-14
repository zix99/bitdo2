#!/bin/bash
set -e

pushd exchanges/gdax
npm install
popd

pushd exchanges/bittrex
npm install
popd

pushd exchanges/mock
npm install
popd

pushd plugins/web
npm install
popd
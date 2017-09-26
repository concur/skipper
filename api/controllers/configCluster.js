"use strict";
var config = require('../../default/config');
var store = require('./store/exports');

module.exports = {
  getConfig: getConfig,
  addConfig: addConfig,
  delConfig: delConfig
};

const addLocation = function (array, value) {
  //expects value.context
  if (!value.hasOwnProperty('context')) {
    return;
  }
  var exists = false;
  for (var i = 0; i < array.length; i++) {
    if (array[i].hasOwnProperty('context') && array[i].context === value.context) {
      exists = true;
      array[i] = value; //update
    }
  }
  if (!exists) {
    array.push(value);
  }
}

const delLocation = function (array, value) {
  //expects value.context
  if (!value.hasOwnProperty('context')) {
    return;
  }
  var exists = false;
  for (var i = 0; i < array.length; i++) {
    if (array[i].hasOwnProperty('context') && array[i].context === value.context) {
      array.splice(i, 1);
    }
  }
}

const handleResponse = function (err, data, res) {
  if (err) {
    errResponse(err, res);
  } else {
    res.status(200).json(data);
  }
}

const errResponse = function (err, res) {
  console.log(err);
  res.status(500).json({err: true, result: {message: 'error getting/setting k8s clusters in db: ' + err}});
}

function getConfig(req, res) {
  store.getJSON("k8sclusters", function (err, data) {
    return handleResponse(err, data, res);
  });
}
  
function addConfig(req, res) {
  var reqdata = JSON.parse(JSON.stringify(req.body));
  store.getJSON("k8sclusters", function (err, data) {
    if (err) {
      return errResponse(err, res);
    } else {
      if (!data.hasOwnProperty('locations')) {
        data.locations = [];
      }
      addLocation(data.locations, reqdata);
      store.putJSON("k8sclusters", data, function (err, data2) {
        return handleResponse(err, data, res);
      });
    }
  });
}

function delConfig(req, res) {
  var reqdata = JSON.parse(JSON.stringify(req.body));
  store.getJSON("k8sclusters", function (err, data) {
    if (err) {
      return errResponse(err, res);
    } else {
      delLocation(data.locations, reqdata);
      store.putJSON("k8sclusters", data, function (err, data2) {
        return handleResponse(err, data, res);
      });
    }
  });
}
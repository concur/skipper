var config = require('../../../default/config');
var store = require('./' + config.storage.type);

exports.delJSON = function (key, callback) {
  store.delConfigItemsJSON(key, function (err, data) {
    return callback(err, data);
  });
};

exports.getJSON = function (key, callback) {
  store.getConfigItemsJSON(key, function (err, data) {
//    console.log("getJSON data:", data);
    return callback(err, data);
  });
};

exports.putJSON = function (key, object, callback) {
  store.putConfigItemsJSON(key, object, function (err, data) {
    callback(err, data);
  });
};

exports.delConfigItems = function (key, item, callback) {
  store.delConfigItems(key, item, function (err, data) {
    return callback(err, data);
  });
};

exports.getConfigItems = function (key, callback) {
  store.getConfigItems(key, function (err, data) {
    return callback(err, data);
  });
};

exports.putConfigItems = function (key, item, callback) {
  if (item == undefined || item == "") {
    console.log("error unable to store undefined or empty values:", key);
    return callback(true, "error unable to store undefined or empty values:", key);
  }
  store.putConfigItems(key, item, function (err, data) {
    return callback(err, data);
  });
};
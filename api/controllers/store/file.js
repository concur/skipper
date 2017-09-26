'use strict';

var _ = require('lodash');
var async = require('async');
var jsonfile = require('jsonfile');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var config = require('../../../default/config');

const escapeRegExp = function (str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};

const replaceAll = function (str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};

const ensureExists = function (path, cb) {
  var mask = parseInt('0770', 8);
    mkdirp.mkdirp(path, mask, function(err, made) {
      cb(err);
    });
};

const getFile = function (queryitem, callback) {
  var filename = path.join(config.storage.fileStoreLocation, replaceAll(queryitem, ".", "/")) + '.json';
  var dirname = path.dirname(filename)
  ensureExists(dirname, function(err) {
    if (err) {
      console.log("Error creating directory", dirname, "for file store:", err);
    }
    callback(err, filename);
  });
};

exports.delConfigItemsJSON = function (queryitem, callback) {
  getFile(queryitem, function (err, file) {
    fs.unlink(file, function (err) {
      if (err && err.code == "ENOENT") {
        return callback(null, null);
      } else {
        return callback(err, null);
      }
    });
  });
};

exports.getConfigItemsJSON = function (queryitem, callback) {
  getFile(queryitem, function (err, file) {
    jsonfile.readFile(file, function(err, obj) {
      if (err && err.code == "ENOENT") {
        return callback(null, {});
      } else {
        return callback(err, obj);
      }
    });
  });
};

exports.putConfigItemsJSON = function (queryitem, obj, callback) {
  getFile(queryitem, function (err, file) {
    jsonfile.writeFile(file, obj, function (err) {
      return callback(err, obj);
    });
  });
};

exports.delConfigItems = function (queryitem, configvalue, callback) {
  getFile(queryitem, function (err, file) {
    jsonfile.readFile(file, function(err, obj) {
      if (err) {
        //assume the file DNE
        obj = [];
      }
      obj = _.without(obj, configvalue);
      jsonfile.writeFile(file, obj, function (err) {
        return callback(err, obj);
      });
    });
  });
};

exports.getConfigItems = function (queryitem, callback) {
  getFile(queryitem, function (err, file) {
    jsonfile.readFile(file, function(err, obj) {
      return callback(err, obj);
    });
  });
};

exports.putConfigItems = function (queryitem, configvalue, callback) {
  getFile(queryitem, function (err, file) {
    jsonfile.readFile(file, function(err, obj) {
      if (err) {
        //assume the file DNE
        obj = [];
      }
      obj = _.union(obj, [configvalue]);
      jsonfile.writeFile(file, obj, function (err) {
        return callback(err, obj);
      });
    });
  });
};

"use strict";

var _ = require('lodash');
var store = require('./store/exports');
var validate = require('./deploy/validate');
var k8sHelper = require('./deploy/k8sHelper');

const parseSwaggerParams = function (req) {
  var result = {};
  
  if (req == null || req.swagger == null || !_.isObject(req.swagger.params)) {
    return;
  }

  for (var param in req.swagger.params) {
    if (req.swagger.params[param].value != null) {
      if (result[param] == null) {
        result[param] = req.swagger.params[param].value;
      }
    }
  }
  
  return result;
}

// Get list of deployments
exports.index = function (req, res) {
  // Params
  // user: "" // optional
  //
  
  var reqdata = _.merge(JSON.parse(JSON.stringify(req.body)), parseSwaggerParams(req)), deploymentquery = "";
  
  if (reqdata.deployment != null && reqdata.deployment != "") {
    deploymentquery = reqdata.deployment;
  }

  if (req.swagger.params.deployment == null || req.swagger.params.deployment == "") {
    deploymentquery = "master.deployments";
  }

  if (reqdata.user != "" && reqdata.user != null) {
    deploymentquery = reqdata.user + ".deployments";
  }
  
  if (reqdata.namespace != "" && reqdata.namespace != null &&
      reqdata.name != "" && reqdata.name != null &&
      reqdata.type != "" && reqdata.type != null ) {
    deploymentquery = reqdata.namespace + "." + reqdata.type + "." + reqdata.name;
  }
  
  console.log("Get", deploymentquery, "namespace:", reqdata.namespace);

  store.getConfigItems(deploymentquery, function (err, data) {
    var results = {err: false, result: {message: 'deployments found in db'}};
    
    if (err) {
      console.log(err);
      results = {err: true, result: {message: 'error getting deployments from db: ' + err}};
    } else if (data == undefined || data.constructor !== Array) {
      // record not found
      console.log('deployments NOT found in db.', deploymentquery, data);
      results = {err: true, result: {message: 'no deployments found in db list: ' + err}};
    }
    k8sHelper.validate.handleResponse({deployments: data}, res, err || 200, results);
    
  });
};

// Get a specific deployment
exports.show = function (req, res) {
  // Params
  // deployment: "string" // required
  // version: "string" // required
  
  var reqdata = _.merge(JSON.parse(JSON.stringify(req.body)), parseSwaggerParams(req));
  
  if (reqdata.deployment == null || reqdata.deployment == "") {
    return k8sHelper.validate.handleResponse({}, res, 422, {result: {message: 'no deployment was specified.'}});
  }

  if (reqdata.version != null && reqdata.version != "") {
    reqdata.deployment = reqdata.deployment + ".version." + reqdata.version
  }
  
  console.log("Get", reqdata.deployment);

  store.getJSON(reqdata.deployment, function (err, data) {
    validate.cleanupReqdata(data);
    
    if (err) { // error
      data.result = {message: 'error getting deployments from db: ' + err};
    } else if (data != null && _.isObject(data)) {
      //record found
      if (_.isEmpty(data)) {
        data.result = {message: "deployment deleted"};
      } else {
        data.result = {message: "deployment found in db"};
      }
    } else {
      // record not found
      data.result = {message: 'no deployments found in db: ' + err};
      console.log('deployment NOT found in db.', reqdata.deployment, data);
    }
    k8sHelper.validate.handleResponse(data, res, err || 200, data.result);

  });
};


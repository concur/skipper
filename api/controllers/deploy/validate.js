"use strict";

var _ = require('lodash');
var config = require('../../../default/config');
var k8sHelper = require('./k8sHelper');

const setRequestKey = function (reqdata) {
  reqdata.key = reqdata.namespace + "." + reqdata.type + "_" + reqdata.name;
}

exports.cleanupReqdata = function (reqdata) {
  
  if (reqdata == undefined) {
    return;
  }
  
  reqdata.token = "REDACTED";
  delete reqdata.kind;
  delete reqdata.user;
  delete reqdata.external;
  delete reqdata.key;
  delete reqdata.configitem;
  delete reqdata.result;
  
  if (!reqdata.manageServices) {
    delete reqdata.kubesvcjson;
    delete reqdata.containers;
    delete reqdata.serviceType;
  }
  
  if (reqdata.type == "secrets") {
    delete reqdata.kubercjson;
    if (reqdata.k8s != null) {
      reqdata.k8s.data = {"REDACTED": "true"};
    }
  }
  
}

exports.validateDestroy = function (reqdata, callback) {

  // fields * = required
  // *name: string - service name -- required & must match api parameter
  // type: type of objects to delete -- defaults to deployments
  // clusters: int - number of k8sclustes to run your service against -- defaults to all available in the location
  // *namespace || user: string - namespace || user for token auth to k8s -- required
  // *token: string - token for auth to k8s -- required
  // *targetPort: int - container port to expose -- required to determine which container to expose as a service
  // group: string - group for this deployment: ex. blue/green/canary -- defaults to "green"
  // locations: [{"name": "msp", "clusters": ["", ""]}, {"name": "sea", "clusters": ["", ""]}]
  // removeService: bool -- default = false
  reqdata.deleteClusters = [];
  reqdata.version = Date.now();
  
  if (reqdata.type == null || reqdata.type == "") {
    reqdata.type = "deployments"
  }
  
  if (reqdata.name == null || reqdata.name == "") {
    return callback(422, 'Missing required field: name');
  }

  if (reqdata.name.length > 23 ) {
    return callback(422, 'The object "name" field must be less than 24 characters.');
  } else {
    //eliminate underscores
    //TODO: handle other invalid DNS characters
    reqdata.name = k8sHelper.replaceAll(reqdata.name,"_","-");
  }

  if (reqdata.user == null || reqdata.user == "") {
    if (reqdata.namespace != null && reqdata.namespace != "") {
      reqdata.user = reqdata.namespace;
    } else {
      return callback(422, 'Missing required field: user || namespace');
    }
  }

  if (reqdata.namespace == null || reqdata.namespace == "") {
    if (reqdata.user != null && reqdata.user != "") {
      reqdata.namespace = reqdata.user;
    } else {
      return callback(422, 'Missing required field: user || namespace');
    }
  }

  if (reqdata.token == null || reqdata.token == "") {
    return callback(422, 'Missing required field: token');
  }
  
  if (reqdata.locations == null || reqdata.locations == "") {
    return callback(422, 'Missing required field: locations');
  } else if (reqdata.locations[0].name == null || reqdata.locations[0].name == "" ) {
    return callback(422, 'locations must be an array of {"name": "location"');
  }

  //set group selector if it exists
  if (reqdata.targetGroup != "" && reqdata.targetGroup != null) {
    reqdata.deployment = reqdata.name + "-" + reqdata.targetGroup;
  } else {
    reqdata.deployment = reqdata.name;
  }
  
  setRequestKey(reqdata);
  
  if (typeof config.customValidateDestroyHandler === 'function') {
    config.customValidateDestroyHandler(reqdata);
  }
  
  console.log(reqdata.key, "Delete", reqdata.type, reqdata.name, "namespace:", reqdata.namespace, "locations:", reqdata.locations, "clusters:", reqdata.clusters, "removeService:", reqdata.removeService);
  
  return callback(null, null);
  
}

exports.validateENVs = function (array) {
  var keys = {}, res = "";
  
  //build the list of keys
  for (var i = 0; i < array.length; i++) {
    if (array[i].hasOwnProperty('name') && !array[i].hasOwnProperty('valueFrom')) {
      keys[array[i].name] = true;
    }
  }
  
  for (var i = 0; i < array.length; i++) {
    if (array[i].hasOwnProperty('value')) {
      res = array[i].value.match(/[$]*[(][a-zA-Z_$0-9]+[)]/g);
      if (res == null ) {
        continue;
      }
        for (var j = 0; j < res.length; j++) {
        if (res[j] == "" || res[j] == null || res[j].substr(0,2) == "$$") {
          continue;
        }
        if (!keys.hasOwnProperty(res[j].substr(2,res[j].length-3))) {
          array[i].value = k8sHelper.replaceAll(array[i].value, res[j], "");
        }
      }
    }
  }

};

exports.validateUpdateIndex = function (reqdata, callback) {
  
  // fields * = required
  // *name: string - service name -- required & must match api parameter
  // type: string - deployment (default), job, statefulset, configmap, secret, daemonset
  // replicas: int - number of copys of your container spec you'd like to run -- defaults to 2
  // clusters: int - number of k8sclustes to run your service against -- defaults to all available in the location
  // *containers: {*name: string, *image: string, *port: int, env {name: string, value: string}} -- required
  // *user: string - username for token auth to k8s -- required for some clusters
  // *token: string - token for auth to k8s -- required for some clusters
  // namespace: string - defaults to the user, available for override
  // *targetPort: int - container port to expose -- required to determine which container to expose as a service
  // *loadBalanced: true|false
  // group: string - group for this deployment: ex. blue/green/canary -- defaults to "green"
  // targetGroup: "string" // groups that the service will select - default is to keep the values from the last deployment - if none found none will be set and all groups will be selected
  // build: string - build number, commit hash or version - optional
  // locations: ["msp", "sea", "dfw", "par", "ams"] #deploy locations (default is everywhere)
  // locations: [{"name": "msp", "clusters": ["", ""]}, {"name": "sea", "clusters": ["", ""]}]
  // autodeploy: true|false #run deployment when container registry updates (default is yes)
  // deploymentStrategy: rolling|fast - default is fast
  // healthCheck: "http" || "tcp" || "none" - default is http on /health
  // imagePullSecrets: "name of the secret in your namespace that has the login information to a container registry"
  // annotations: {"annotationitem": "annotation data", ...} - applied to both the services and deployments
  
  reqdata.deployClusters = [];
  reqdata.deleteClusters = [];
  reqdata.endpoints = {}; //setup for adding records later

  // get the version from the first container tag
  if (!_.has(reqdata, 'version') && _.has(reqdata, 'containers[0].image')) {
    var ver = _.split(reqdata.containers[0].image, ":", 2);
    if (ver.length == 2 && ver[1] != "") {
      reqdata.version = ver[1];
    }
  }

  //set version if still not set
  if (!_.has(reqdata, 'version') || reqdata.version == "") {
    reqdata.version = Date.now().toString();
  }
  
  if (reqdata.loadBalanced == true ||
      reqdata.targetPort != null) {
    reqdata.manageServices = true;
  } else {
    reqdata.manageServices = false;
  }

  if (reqdata.name == null || reqdata.name == "") {
    return callback(422, 'Missing required field: name');
  }

  if (reqdata.name.length > 23 ) {
    return callback(422, 'The deployment "name" field must be less than 24 characters.');
  } else {
    //eliminate underscores
    reqdata.name = k8sHelper.replaceAll(reqdata.name,"_","-");
  }
  

  if (reqdata.user == null || reqdata.user == "") {
    if (reqdata.namespace != null && reqdata.namespace != "") {
      reqdata.user = reqdata.namespace;
    } else {
      return callback(422, 'Missing required field: user || namespace');
    }
  }

  if (reqdata.namespace == null || reqdata.namespace == "") {
    if (reqdata.user != null && reqdata.user != "") {
      reqdata.namespace = reqdata.user;
    } else {
      return callback(422, 'Missing required field: user || namespace');
    }
  }

  if (reqdata.token == null || reqdata.token == "") {
    return callback(422, 'Missing required field: token');
  }
  
  //validate type
  if (reqdata.type == null || reqdata.type == "") {
    reqdata.type = "deployments";
  }
  
  if (!["configmaps", "daemonsets", "deployments", "horizontalpodautoscalers", "jobs", "secrets", "services", "statefulsets"].includes(reqdata.type)) {
    return callback(422, 'Type must be one of: "configmaps", "daemonsets", "deployments", "horizontalpodautoscalers", "jobs", "secrets", "services", "statefulsets"');
  }
  
  if (reqdata.containers == null || reqdata.containers == "") {
    reqdata.containers = [];
  }
  
  if (reqdata.targetPort != null && reqdata.targetPort != "") {
    if (!_.isNumber(reqdata.targetPort)) {
      return callback(422, 'Field targetPort must be a number');
    }
  }
  
  if (reqdata.clusters != null && reqdata.clusters != "") {
    if (!_.isNumber(reqdata.clusters)) {
      return callback(422, 'Field clusters must be a number');    
    }
  } else {
    reqdata.clusters = config.maxClustersPerLocation;
  }
  
  if (reqdata.replicas != null && reqdata.replicas != "") {
    if (!_.isNumber(reqdata.replicas)) {
      return callback(422, 'Field replicas must be a number');
    }
  }
  
  if (reqdata.loadBalanced == true) {
    reqdata.serviceType = "LoadBalancer";
  } else {
    reqdata.serviceType = "ClusterIP";
  }
  
  if (reqdata.locations == null || reqdata.locations == "") {
    reqdata.locations = config.defaultLocations;
  }
  
  // handle old api
  var locations = [];
  for (var i = 0; i < reqdata.locations.length; i++) {
    if (reqdata.locations[i].name == undefined) {
      locations.push({"name": reqdata.locations[i]});
    }
  }
  
  if (locations[0] != undefined) {
    reqdata.locations = locations;
    console.log(reqdata.key, "reqdata.locations:", reqdata.locations);
  }
  
  if (reqdata.autodeploy == null || reqdata.autodeploy == "") {
    reqdata.autodeploy = true;
  }
  
  if (reqdata.deploymentStrategy == null || reqdata.deploymentStrategy == "") {
    reqdata.deploymentStrategy = "rolling";
  }
  
  if (reqdata.healthCheck == null || reqdata.healthCheck == "") {
    reqdata.healthCheck = "http";
  }
  
  if (reqdata.external != true) {
    reqdata.external = false;
  }
  
  if (reqdata.annotations == null || reqdata.annotations == "" ) {
    reqdata.annotations = {};
  }
  
  //for each container
  for (var i = 0; i < reqdata.containers.length; i++) {
    if (reqdata.containers[i].name == "" ||
    reqdata.containers[i].image == "" || !_.isNumber(reqdata.containers[i].port)) {
      return callback(422, 'Missing required field in containers array: name, image, port');
    }
  }
  
  setRequestKey(reqdata);
  
  if (typeof config.customValidateUpdateIndex === 'function') {
    config.customValidateUpdateIndex(reqdata);
  }

  console.log(reqdata.key, "Update", "locations:", reqdata.locations, "clusters:", reqdata.clusters, "manageServices:", reqdata.manageServices);
  
  return callback(null, null);
}

exports.handleResponse = function (reqdata, res, code, message) {
  exports.cleanupReqdata(reqdata);
  
  if (!_.isNumber(code)) {
    //preserve content of error message
    if (message == null) {message = code;}
    if (_.isArray(message)) {message.push(code);}
    code = 500;
  }
  
  if (code == 200 || code == null) {
  reqdata.err = false;
  reqdata.result = {message: "completed API calls."};
  } else {
    reqdata.err = true;
    reqdata.result = {message: "error during API calls: " + message};
  }
  
  if (_.isArray(message)) {
    var m =  _.compact(message);
    if (m.length == 1) {
      reqdata.result.message = m[0];
    } else if (m.length > 1) {
      reqdata.result.messages = m;
    }
  }
  
  if (code != null && !_.isNumber(code)) {
    code = 500;
  }
  
  res.status(code).json(reqdata);
}
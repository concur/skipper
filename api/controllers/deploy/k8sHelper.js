"use strict";

var _ = require('lodash');
var k8s = require('node-kubernetes-client');
var config = require('../../../default/config');
exports.k8sCRUD = require('./k8sCRUD');
exports.k8sTypes = require('./k8sTypes');
exports.process = require('./process');
exports.validate = require('./validate');

const escapeRegExp = function (str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

exports.replaceAll = function (str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

exports.addENV = function (array, value) {
  //expects value.name
  if (array.env == undefined || array.env == null || array.env.constructor !== Array) {
    array.env = [];
  }
  
  if (!value.hasOwnProperty('name')) {
    return;
  }
  var exists = false;
  for (var i = 0; i < array.length; i++) {
    if (array[i].hasOwnProperty('name') && array[i].name === value.name) {
      exists = true;
    }
  }
  if (!exists) {
    array.push(value);
  }
}

exports.handleContainerParams = function (healthCheck, containerReqdata, kubercjson) {
  //containerReqdata = reqdata.containers[i]
  
  var containerjson =           
    {
      "name": containerReqdata.name,
      "image": containerReqdata.image,
      "ports": [],
      "env": [],
      "imagePullPolicy": containerReqdata.imagePullPolicy || "IfNotPresent",
      resources: {
        requests: {},
        limits: {}
      }
    };
  
  //handle min/max cpu/mem
  if (containerReqdata.mincpu != null && containerReqdata.mincpu != "") {
    containerjson.resources.requests.cpu = containerReqdata.mincpu;
  }
  if (containerReqdata.maxcpu != null && containerReqdata.maxcpu != "") {
    containerjson.resources.limits.cpu = containerReqdata.maxcpu;
  }
  if (containerReqdata.minmem != null && containerReqdata.minmem != "") {
    containerjson.resources.requests.memory = containerReqdata.minmem;
  }
  if (containerReqdata.maxmem != null && containerReqdata.maxmem != "") {
    containerjson.resources.limits.memory = containerReqdata.maxmem;
  }  
  
  //handle multiple ports for the container if it's an array
  if (containerReqdata.port.constructor === Array) {
    for (var ports = 0; ports < containerReqdata.port.length; ports++) {
      containerjson.ports.push({"containerPort": containerReqdata.port[ports]});
    }
  } else {
    containerjson.ports.push({"containerPort": containerReqdata.port});
  }

  //allow commands to be passed to containers
  if (containerReqdata.command != null && containerReqdata.command != "" && containerReqdata.command.constructor === Array) {
    containerjson.command = [];
    containerjson.command = containerReqdata.command;
  }

  //reqdata.healthCheck = "http" || "tcp" || "none"
  if (healthCheck == "http") {
    containerjson.livenessProbe = {
        "httpGet": {
          "path": config.defaultHealthCheck,
          "port": containerReqdata.port
        },
        "initialDelaySeconds": 120,
        "timeoutSeconds": 1
      };
    containerjson.readinessProbe = {
        "httpGet": {
          "path": config.defaultHealthCheck,
          "port": containerReqdata.port
        },
        "initialDelaySeconds": 5,
        "timeoutSeconds": 1
      };
  }
  if (healthCheck == "tcp") {
    containerjson.livenessProbe = {
        "tcpSocket": {
          "port": containerReqdata.port
        },
        "initialDelaySeconds": 120,
        "timeoutSeconds": 1
      };
    containerjson.readinessProbe = {
        "tcpSocket": {
          "port": containerReqdata.port
        },
        "initialDelaySeconds": 5,
        "timeoutSeconds": 1
      };
  }

  if (containerReqdata.periodSeconds != null && containerReqdata.periodSeconds != "" && _.isNumber(containerReqdata.periodSeconds)) {
    //update both
    containerjson.readinessProbe.periodSeconds = containerReqdata.periodSeconds;
    containerjson.livenessProbe.periodSeconds = containerReqdata.periodSeconds;
  }

  if (containerReqdata.readinessPeriodSeconds != null && containerReqdata.readinessPeriodSeconds != "" && _.isNumber(containerReqdata.readinessPeriodSeconds)) {
    containerjson.readinessProbe.periodSeconds = containerReqdata.readinessPeriodSeconds;
  }

  if (containerReqdata.livenessPeriodSeconds != null && containerReqdata.livenessPeriodSeconds != "" && _.isNumber(containerReqdata.livenessPeriodSeconds)) {
    containerjson.livenessProbe.periodSeconds = containerReqdata.livenessPeriodSeconds;
  }

  if (containerReqdata.failureThreshold != null && containerReqdata.failureThreshold != "" && _.isNumber(containerReqdata.failureThreshold)) {
    //update both
    containerjson.readinessProbe.failureThreshold = containerReqdata.failureThreshold;
    containerjson.livenessProbe.failureThreshold = containerReqdata.failureThreshold;
  }

  if (containerReqdata.readinessFailureThreshold != null && containerReqdata.readinessFailureThreshold != "" && _.isNumber(containerReqdata.readinessFailureThreshold)) {
    containerjson.readinessProbe.FailureThreshold = containerReqdata.readinessFailureThreshold;
  }

  if (containerReqdata.livenessFailureThreshold != null && containerReqdata.livenessFailureThreshold != "" && _.isNumber(containerReqdata.livenessFailureThreshold)) {
    containerjson.livenessProbe.FailureThreshold = containerReqdata.livenessFailureThreshold;
  }

  if (containerReqdata.timeoutSeconds != null && containerReqdata.timeoutSeconds != "" && _.isNumber(containerReqdata.timeoutSeconds)) {
    //update both
    containerjson.readinessProbe.timeoutSeconds = containerReqdata.timeoutSeconds;
    containerjson.livenessProbe.timeoutSeconds = containerReqdata.timeoutSeconds;
  }
  
  //handle secret volumes
  if (containerReqdata.secretmount != null && containerReqdata.secretmount.secret != null && containerReqdata.secretmount.mountpath != null) {
    if (kubercjson.spec.template.spec.volumes == undefined) {
      kubercjson.spec.template.spec.volumes = [];
    }
    kubercjson.spec.template.spec.volumes.push({
        "name": "secret-volume",
        "secret": {
            "secretName": containerReqdata.secretmount.secret
        }
    });
    if (containerjson.volumeMounts == undefined) {
      containerjson.volumeMounts = [];
    }
    containerjson.volumeMounts.push({
        "name": "secret-volume",
        "mountPath": containerReqdata.secretmount.mountpath
    });
  }
  
  //handle emptydir volumes
  if (containerReqdata.emptyDir != null && containerReqdata.emptyDir != "") {
    if (kubercjson.spec.template.spec.volumes == undefined) {
      kubercjson.spec.template.spec.volumes = [];
    }
    kubercjson.spec.template.spec.volumes.push({
        "name": "empty",
        "emptyDir": {}
    });
    if (containerjson.volumeMounts == undefined) {
      containerjson.volumeMounts = [];
    }
    containerjson.volumeMounts.push({
        "name": "empty",
        "mountPath": containerReqdata.emptyDir
    });
  }
  
  //handle container securityContext
  if (containerReqdata.capabilities != null && containerReqdata.capabilities.constructor === Array) {
    containerjson.securityContext = {};
    containerjson.securityContext.capabilities = {};
    containerjson.securityContext.capabilities.add = containerReqdata.capabilities;
  }
  
  //handle configmapMount
  if (containerReqdata.configMapMount != null && containerReqdata.configMapMount.constructor === Array) {
    for (var mounts = 0; mounts < containerReqdata.configMapMount.length; mounts++) {
      if (kubercjson.spec.template.spec.volumes == undefined) {
        kubercjson.spec.template.spec.volumes = [];
      }
      kubercjson.spec.template.spec.volumes.push({
          "name": "config-volume-" + mounts,
          "configMap": {
              "name": containerReqdata.configMapMount[mounts].configMap
          }
      });
      if (containerjson.volumeMounts == undefined) {
        containerjson.volumeMounts = [];
      }
      containerjson.volumeMounts.push({
          "name": "config-volume-" + mounts,
          "mountPath": containerReqdata.configMapMount[mounts].mountPath
      });
    }
  }
  
  //handle env
  if (Array.isArray(containerReqdata.env)) {
    for (var envs = 0; envs < containerReqdata.env.length; envs++) {
      exports.addENV(containerjson.env, containerReqdata.env[envs]);
    }
  }
  
  //handle configMapEnv
  if (containerReqdata.configMapEnv != null && containerReqdata.configMapEnv.constructor === Array) {
    for (var envs = 0; envs < containerReqdata.configMapEnv.length; envs++) {
      containerjson.env.push({
        "name": containerReqdata.configMapEnv[envs].env,
        "valueFrom": {
          configMapKeyRef: {
            name: containerReqdata.configMapEnv[envs].configMap,
            key: exports.replaceAll(containerReqdata.configMapEnv[envs].key, "_", ".")
          }
        }
      });
    }
  }
    
  //handle secretEnv
  if (containerReqdata.secretEnv != null && containerReqdata.secretEnv.constructor === Array) {
    for (var envs = 0; envs < containerReqdata.secretEnv.length; envs++) {
      containerjson.env.push({
        "name": containerReqdata.secretEnv[envs].env,
        "valueFrom": {
          secretKeyRef: {
            name: containerReqdata.secretEnv[envs].secret,
            key: containerReqdata.secretEnv[envs].key
          }
        }
      });
    }
  }
  
  //add basic required template
  _.merge(kubercjson, {"spec":{"template":{"spec":{containers:[]}}}});
  
  //add container specific json override to kubercjson
  _.merge(containerjson, containerReqdata.k8s);
  
  kubercjson.spec.template.spec.containers.push(containerjson);
  
};
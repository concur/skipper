"use strict";

var _ = require('lodash');
var k8sHelper = require('./k8sHelper');
var config = require('../../../default/config');

exports.applyActionForLocation = function (reqdata, action, configloc, callback) {
  var configLocation = JSON.parse(JSON.stringify(configloc)), kubercjsonreplaced = {}, splitURL =  _.split(configLocation.server.toString(), '://');
  
  configLocation.endpointDomain = "";
  configLocation.serviceDNS = "";
  configLocation.serviceendpoint = "";
  
  if (action == "skip") {
    return callback(null, "move to next record");
  }
  
  if (reqdata.kubercjson != null) {
    var kubercjsonreplaced = JSON.parse(JSON.stringify(reqdata.kubercjson)); //copy
  } else {
    kubercjsonreplaced = {};
  }
  
  if (typeof config.customLocationProcessingHandler === 'function') {
    config.customLocationProcessingHandler(action, reqdata, configLocation, kubercjsonreplaced);
  }
  
  var kubeapiParams = {
    host:  splitURL[1],
    protocol: splitURL[0],
    version: 'v1',
    token: reqdata.token,
    namespace:  reqdata.namespace,
    reqOptions: {proxy: configLocation.proxy || null,
                 headers: {'correlationid': reqdata.correlationid || null}
                },
    timeout: 20000,
    cluster: configLocation
  };
  
  if (action == "remove") {
    //remove only deletes service records to prevent external access
    if (reqdata.manageServices) {      
      //max reach for this location but must remove extras 
      k8sHelper.k8sCRUD.deleteService(reqdata.name, kubeapiParams, function (err, data) {
        //letting this run in parrallel since service removal should be fast and doesn't always happen
        if (err) {
          console.log(reqdata.key, "error deleting service:", data);
          return callback(null, "error deleting service from: " + configLocation.context)
        } else {
          //document and store result
          data.location = configLocation.location;
          data.context = configLocation.context;
          reqdata.deleteClusters.push(data);
          return callback(null, "deleted service from: " + configLocation.context)
        }
      });
    } else {
      return callback(null, "move to next record"); //move to next record
    }
  }
 
  if (action == "add") {
    console.log(reqdata.key, "deploying to k8scluster:", configLocation.context, splitURL[1] );

    if (configLocation.endpointDomain == "") {
      configLocation.endpointDomain = configLocation.ingressDomain || configLocation.domain || config.domain;
    }
    
    if (configLocation.serviceDNS == "") {
      configLocation.serviceDNS = reqdata.name + "-" + reqdata.namespace + "." + configLocation.endpointDomain;
    }
    
    if (configLocation.serviceendpoint == "") {
      configLocation.serviceendpoint = "https://" + configLocation.serviceDNS;
    }

    reqdata.endpoints[configLocation.location] = {};

    if (config.storage.skipSecrets && reqdata.type != "secrets") {
      reqdata.endpoints[configLocation.location].this = config.skipperEndpoint + "/api/v1/deployment/history." + configLocation.location + "." + reqdata.key + "." + reqdata.version;
      reqdata.endpoints[configLocation.location].latest = config.skipperEndpoint + "/api/v1/deployment/current." + configLocation.location + "." + reqdata.key;
    }

    //set service details in output
    if (reqdata.manageServices && reqdata.loadBalanced) {
      reqdata.endpoints[configLocation.location].type = "service";
      reqdata.endpoints[configLocation.location].url = configLocation.serviceendpoint;
    }

    if (reqdata.kind.containerSpec && _.has(kubercjsonreplaced, "spec.template.spec.containers")) {
      for (var k = 0; k < kubercjsonreplaced.spec.template.spec.containers.length; k++) {

        //replace registry endpoints as required
        if (config.srcReplacementRepos.length > 0) {
          console.log(reqdata.key, "Docker image before replace", kubercjsonreplaced.spec.template.spec.containers[k].image);
          for (var replaceRepo = 0; replaceRepo < config.srcReplacementRepos.length; replaceRepo++) {
            kubercjsonreplaced.spec.template.spec.containers[k].image = k8sHelper.replaceAll(kubercjsonreplaced.spec.template.spec.containers[k].image,config.srcReplacementRepos[replaceRepo],configLocation.registry);
          }
          console.log(reqdata.key, "Docker image after replace", kubercjsonreplaced.spec.template.spec.containers[k].image);
        }

        //add LOCATION, SERVICE_ENDPOINT and K8SCONTEXT to the defaultENV array
        k8sHelper.addENV(configLocation.defaultENV, {name: "LOCATION", value: configLocation.location});
        k8sHelper.addENV(configLocation.defaultENV, {name: "SERVICE_ENDPOINT", value: configLocation.serviceendpoint});
        k8sHelper.addENV(configLocation.defaultENV, {name: "K8SCONTEXT", value: configLocation.context});

        //set Environment variables for this container & location
        for (var l = 0; l < configLocation.defaultENV.length; l++) {
          k8sHelper.addENV(kubercjsonreplaced.spec.template.spec.containers[k].env, configLocation.defaultENV[l]);
        }

        k8sHelper.validate.validateENVs(kubercjsonreplaced.spec.template.spec.containers[k].env);
      }
    }

    k8sHelper.k8sCRUD.ensureObject(kubercjsonreplaced, kubeapiParams, reqdata.type, reqdata, function (err, data) {
      if (err) {
        console.log(reqdata.key, "error updating", reqdata.type, ":", data);
        return callback(err, "error checking for " + reqdata.type);
      } else {
        data.location = configLocation.location;
        data.context = configLocation.context;
        reqdata.deployClusters.push(data);
        if (reqdata.manageServices) {
          console.log(reqdata.key, "updating service:", reqdata.kubesvcjson.metadata.name, configLocation.context);
          k8sHelper.k8sCRUD.ensureObject(reqdata.kubesvcjson, kubeapiParams, 'services', reqdata, function (err, data) {
            if (err) {
              console.log(reqdata.key, "error updating service:", data);
              return callback(err, "error updating service:" + reqdata.key);
            } else {
              data.location = configLocation.location;
              data.context = configLocation.context;
              reqdata.deployClusters.push(data);
              if (configLocation.ingressDomain != null && configLocation.ingressDomain != "" && reqdata.loadBalanced) {
                console.log(reqdata.key, "updating ingress:", reqdata.name, configLocation.context);
                var kubeingress = {
                  "apiVersion": "extensions/v1beta1",
                  "kind": "Ingress",
                  "metadata": {
                    "annotations": reqdata.annotations,
                    "name": reqdata.name
                  },
                  "spec": {
                    "rules": [ 
                      {"host": configLocation.serviceDNS, 
                       "http": {"paths": [{"path": "/", "backend": {"serviceName": reqdata.name, "servicePort": reqdata.targetPort}}]}}
                    ],
                    "tls": [{"hosts": [configLocation.serviceDNS]}]
                  }
                };
                
                if (reqdata.annotations["sidecar.istio.io/inject"] == "true") {
                  console.log(reqdata.key, "Adding istio annotation to ingress");
                  kubeingress.metadata.annotations["kubernetes.io/ingress.class"] = "istio";
                  kubeingress.spec.rules[0].http.paths[0].path = "/.*";
                  delete kubeingress.spec.tls;
                }

                k8sHelper.k8sCRUD.ensureObject(kubeingress, kubeapiParams, 'ingresses', reqdata, function (err, data) {
                  if (err) {
                    console.log(reqdata.key, "error updating ingress:", data);
                    return callback(err, "error updating ingress:" + reqdata.key);
                  } else {
                    data.location = configLocation.location;
                    data.context = configLocation.context;
                    reqdata.deployClusters.push(data);
                    return callback(null, data.message);
                  }
                });
              } else {
                return callback(null, data.message);
              }
            }
          });
        } else {
        return callback(null, data.message);
        }
      }
    });
  }
  
  if (action == "delete") {
    //async function for cleaner code
    const deleteObjects = async () => {
      try {
        const deleteObjectResult = await k8sHelper.k8sCRUD.deleteObject(reqdata.name, kubeapiParams, reqdata.type, reqdata);
        deleteObjectResult.location = configLocation.location;
        deleteObjectResult.context = configLocation.context;
        reqdata.deleteClusters.push(deleteObjectResult);
        if (reqdata.removeService) {
          const deleteServiceResult = await k8sHelper.k8sCRUD.deleteObject(reqdata.name, kubeapiParams, 'services', reqdata);
          console.log(reqdata.key, "success deleting services:", deleteServiceResult);
          if (configLocation.ingressDomain != null && configLocation.ingressDomain != "") {
            const deleteIngressResult = await k8sHelper.k8sCRUD.deleteObject(reqdata.name, kubeapiParams, 'ingresses', reqdata);
            console.log(reqdata.key, "success deleting ingresses:", deleteIngressResult);
          }
        }
        console.log(reqdata.key, "success deleting " + reqdata.type + ":", deleteObjectResult.context);
        return callback(null, reqdata.type + " removed for context");
      } catch (err) {
        console.log(reqdata.key, "error deleting " + reqdata.type + ":", err);
        return callback(err, "error deleting " + reqdata.type);
      }
    }
    deleteObjects();
  }
}

exports.getClusterAction = function (deployedClusters, maxClusters, reqLocationClusters, configLocationCluster, deleteAPI) {
  //returns a string of add, remove, delete or skip.
  var action = "add";
  
  if (deployedClusters >= maxClusters) {
    action = "remove";
  }

  //see if we need to honor specific cluster deployments
  if (action == "add" && reqLocationClusters != undefined && reqLocationClusters != null) {
    action = "remove";
    for (var k = 0; k < reqLocationClusters.length; k++) {
      if (configLocationCluster == reqLocationClusters[k]) {
        console.log("specific cluster deployment:", configLocationCluster);
        action = "add";
      }
    }
  }
  
  if (deleteAPI) {
    if (action == "add") { action = "delete"; }
    if (action == "remove") { action = "skip"; }
  }
  
  return action;
}

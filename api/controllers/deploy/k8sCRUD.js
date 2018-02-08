"use strict";

var _ = require('lodash');
var async = require('async');
var k8s = require('node-kubernetes-client');
var k8sHelper = require('./k8sHelper');
var config = require('../../../default/config');
var store = require('../store/exports');

const getKey = function (objectName, objectKind, apiConnectParams) {
  var key = apiConnectParams.cluster.location + '.' + apiConnectParams.cluster.context + '.' + apiConnectParams.namespace + '_' + objectName + '_' + objectKind;
  return key;
}

const savek8sJSON = function (object, apiConnectParams, callback) {
  var key = getKey(object.metadata.name, object.kind, apiConnectParams);

  if (config.storage.skipSecrets && object.kind == "Secret") {
    return callback(null, "skipped for secrets");
  }
  
  store.putJSON(key, object, function (err, data) {
    return callback(err, data);
  });
};

const deletek8sJSON = function (objectName, kind, apiConnectParams, callback) {
  var key = getKey(objectName, kind.kind, apiConnectParams);
  store.delJSON(key, function (err, data) {
    return callback(err, data);
  });
};

const getRequestKey = function (reqdata, apiConnectParams) {
  var key = apiConnectParams.cluster.location + '.' + reqdata.key;
  return key;
}

const saveRequest = function (request, apiConnectParams, callback) {
  if (request == null) {
    return callback(null, "nothing to do");
  }
  
  var reqdata = JSON.parse(JSON.stringify(request)), key = getRequestKey(reqdata, apiConnectParams);
  
  if (config.storage.skipSecrets && reqdata.kind == "secrets") {
    return callback(null, "skipped for secrets");
  }
  
  if (config.storage.removeAuthData) {
    k8sHelper.validate.cleanupReqdata(reqdata);
  }
  
  var storeItems = [
    'current.' + key,
    'history.' + key + '.' + reqdata.version
    ];
  
  async.eachSeries(storeItems, function(item, cb) {
    store.putJSON(item, reqdata, function (err, data) {
      return cb(err, data);
    });
  }, function(err) {
    if (err) {
      return callback(err, "error saving putJSON");
    } else {
      store.putConfigItems('master.deployments', request.key, function (err, data) {
        return callback(err, data);
      });
    }
  });
  
}

const deleteRequest = function (reqdata, apiConnectParams, callback) {
  if (reqdata == null) {
    return callback(null, "nothing to do");
  }

  var key = getRequestKey(reqdata, apiConnectParams);
  
  var storeItems = [
    {key: 'current.' + key, delete: true}, //delete current object
    {key: 'history.' + key + '.' + reqdata.version + '_delete', data: reqdata}
    ];
  
  async.eachSeries(storeItems, function(item, cb) {
    if (item.delete) {
      store.delJSON(item.key, function (err, data) {
        return cb(err, data);
      });
    } else {
      store.putJSON(item.key, item.data, function (err, data) {
        return cb(err, data);
      });
    }
  }, function(err) {
    if (err) {
      return callback(err, "error updating putJSON");
    } else {
      store.delConfigItems('master.deployments', reqdata.key, function (err, data) {
        return callback(err, data);
      });
    }
  });
  
}

const serviceChanged = function (oldSvc, newSvc) {
  //check if the expected fields of the service are different than what is currently set
  var svcChanged = false;
  
  if (oldSvc == undefined) {
    //no need to check further
    return svcChanged;
  }
  
  //delete dynamically added annotations from existing object before comparison
  if (oldSvc != undefined && oldSvc.hasOwnProperty("metadata") && oldSvc.metadata.hasOwnProperty("annotations")) {
    for (var dynA = 0; dynA < config.dynamicServiceAnnotations.length; dynA++) {
      delete oldSvc.metadata.annotations[config.dynamicServiceAnnotations[dynA]];
    }
  }
  
  if (!svcChanged && oldSvc.spec.ports[0].targetPort != newSvc.spec.ports[0].targetPort) {
    svcChanged = true;
    console.log("service target port changed", newSvc.metadata.name);
  }
  
  if (!svcChanged && oldSvc.spec.ports[0].port != newSvc.spec.ports[0].port) {
    svcChanged = true;
    console.log("service port changed", newSvc.metadata.name);
  }
  
  if (oldSvc.metadata.hasOwnProperty("annotations") != newSvc.metadata.hasOwnProperty("annotations")) {
    svcChanged = true;
    console.log("old || new svc does not contain annotations", newSvc.metadata.name);
  }

  if (!svcChanged && oldSvc.metadata.hasOwnProperty("annotations") && newSvc.metadata.annotations.length != oldSvc.metadata.annotations.length) {
    svcChanged = true;
    console.log("Different number of annotations", newSvc.metadata.name);
  }

  if (!svcChanged && !_.isEqual(_.sortBy(newSvc.metadata.annotations), _.sortBy(oldSvc.metadata.annotations))) {
    svcChanged = true;
    console.log("annotations have different values", newSvc.metadata.name);
  }
  
  if (!svcChanged && !_.isEqual(_.sortBy(newSvc.spec.selector), _.sortBy(oldSvc.spec.selector))) {
    svcChanged = true;
    console.log("selectors have different values", newSvc.metadata.name);
  }
  
  return svcChanged;
}

const ensureObjectCU = function (Spec, apiConnectParams, objType, reqdata, callback) {
  var kind = k8sHelper.k8sTypes.getKind(objType), ConnectParams = JSON.parse(JSON.stringify(apiConnectParams)), ensureKubeAPI = {};
  ConnectParams.version = kind.apiVersion;
  ensureKubeAPI = new k8s(ConnectParams);
  ensureKubeAPI.newObj = ensureKubeAPI.createCollection(objType, null, null, { apiPrefix : kind.prefix, namespaced: kind.namespaced });

  ensureKubeAPI.newObj.get(Spec.metadata.name, function (err, data) {
    if (err && err.statusCode == 404) {
      //create
      ensureKubeAPI.newObj.create(Spec, function (err, data) {
        if (err) {
          return callback(err, {"message": "Error creating " + objType + ": " + Spec.metadata.name + " " + err});
        } else {
          return callback(null, {"message": objType + " created: " + Spec.metadata.name});
        }
      });
    } else if (err && err.statusCode != 404) {
      return callback(err, {"message": "Error checking status " + objType + ": " + Spec.metadata.name + " " + err});
    } else {
      //update
      Spec.metadata.resourceVersion = data.metadata.resourceVersion;
      ensureKubeAPI.newObj.update(Spec.metadata.name, Spec, function (err, data2) {
        if (err) {
          return callback(err, {"message": "Error updating " + objType + ": " + Spec.metadata.name + " " + err});
        } else {
          return callback(null, {"message": objType + " updated: " + Spec.metadata.name});
        }
      });
    }
  });
}

const ensureObjectPatchCU = function (Spec, apiConnectParams, objType, reqdata, callback) {
  var kind = k8sHelper.k8sTypes.getKind(objType), ConnectParams = JSON.parse(JSON.stringify(apiConnectParams)), ensureKubeAPI = {};
  ConnectParams.version = kind.apiVersion;
  ensureKubeAPI = new k8s(ConnectParams);
  ensureKubeAPI.newObj = ensureKubeAPI.createCollection(objType, null, null, { apiPrefix : kind.prefix, namespaced: kind.namespaced });

  ensureKubeAPI.newObj.get(Spec.metadata.name, function (err, data) {
    if (err && err.statusCode == 404) {
      //create
      ensureKubeAPI.newObj.create(Spec, function (err, data) {
        if (err) {
          return callback(err, {"message": "Error creating " + objType + ": " + Spec.metadata.name + " " + err});
        } else {
          return callback(null, {"message": objType + " created: " + Spec.metadata.name});
        }
      });
    } else if (err && err.statusCode != 404) {
      return callback(err, {"message": "Error checking status " + objType + ": " + Spec.metadata.name + " " + err});
    } else {
      //update
      Spec.metadata.resourceVersion = data.metadata.resourceVersion;
      ensureKubeAPI.newObj.patch(Spec.metadata.name, Spec, function (err, data2) {
        if (err) {
          return callback(err, {"message": "Error patching " + objType + ": " + Spec.metadata.name + " " + err});
        } else {
          return callback(null, {"message": objType + " patched: " + Spec.metadata.name});
        }
      });
    }
  });
}

const ensureServiceCU = function (Spec, apiConnectParams, objType, reqdata, callback) {
  var kind = k8sHelper.k8sTypes.getKind(objType), ConnectParams = JSON.parse(JSON.stringify(apiConnectParams)), 
      ensureKubeAPI = {};
  ConnectParams.version = kind.apiVersion;
  ensureKubeAPI = new k8s(ConnectParams);
  ensureKubeAPI.newObj = ensureKubeAPI.createCollection(objType, null, null, { apiPrefix : kind.prefix, namespaced: kind.namespaced });

  ensureKubeAPI.newObj.get(Spec.metadata.name, function (err, data) {
    if (err && err.statusCode == 404) {
      //go back to standard ensure
      ensureObjectCU(Spec, apiConnectParams, objType, reqdata, function(err, data2) {
        return callback(err, {"message": objType + " created: " + Spec.metadata.name});
      });
    } else if (err && err.statusCode != 404) {
      console.log(err);
      return callback(err, {"message": objType + " error checking for service: " + Spec.metadata.name});
    } else {
      if (serviceChanged(data, Spec)) {
        exports.recreateObject(Spec, apiConnectParams, objType, reqdata, function(err, data2) {
          return callback(err, {"message": objType + " recreated: " + Spec.metadata.name});
        });
      } else {
        return callback(err, {"message": objType + " already exists: " + Spec.metadata.name});
      }
    }
  });
}

exports.ensureObject = function (Spec, apiConnectParams, objType, requestStore, callback) {
  var ensureFunc = ensureObjectCU, reqdata = JSON.parse(JSON.stringify(requestStore));
  if (objType == "services") {
    ensureFunc = ensureServiceCU;
  } else if (_.get(reqdata, 'patch', false) == true) {
    console.log(reqdata.key, "using patch method.");
    ensureFunc = ensureObjectPatchCU;
  }
  ensureFunc(Spec, apiConnectParams, objType, reqdata, function(err, data) {
    if (err) {
      return callback(err,data);
    } else {
      savek8sJSON(Spec, apiConnectParams, function (err, msg) {
        if (err) {
          console.log("error saving k8sJSON:", err);
          return callback(err,data);
        }
        saveRequest(reqdata, apiConnectParams, function(err, msg) {
          if (err) {
            console.log("error saving request object:", err);
          }
          return callback(err,data);
        });
      });
    }
  });
};

exports.recreateObject = function (Spec, apiConnectParams, objType, requestStore, callback) {
  var reqdata = JSON.parse(JSON.stringify(requestStore));
  exports.deleteObject(Spec.metadata.name, apiConnectParams, objType, reqdata)
    .then(
    function (deleteData) {
      exports.ensureObject(Spec, apiConnectParams, objType, reqdata, function(err, data) {
        return callback(err, data);
      });
    })
    .catch(
    function (err) {
      return callback(err, err);
    });
};

exports.deleteObject = function (objectName, apiConnectParams, objType, requestStore) {
  var objectJSON = {}, reqdata = JSON.parse(JSON.stringify(requestStore));
  
  return new Promise((resolve, reject) => {
    var kind = k8sHelper.k8sTypes.getKind(objType), ConnectParams = JSON.parse(JSON.stringify(apiConnectParams)), deleteKubeAPI = {};
    ConnectParams.version = kind.apiVersion;
    var deleteKubeAPI = new k8s(ConnectParams);
    deleteKubeAPI.delObj = deleteKubeAPI.createCollection(objType, null, null, { apiPrefix : kind.prefix, namespaced: kind.namespaced });

    var deleteFunc = function () {
      deleteKubeAPI.delObj.delete(objectName, function (err, data) {
        if (err && err.statusCode != 404) {
          //something is wrong, bail
          reject({"message": "Error deleting " + objType + ": " + objectName + " " + err});
        } else {
          deletek8sJSON(objectName, kind, ConnectParams, function (err, data) {
            if (err) {
              console.log("error deleting k8sJSON:", err);
            }
            deleteRequest(reqdata, ConnectParams, function(err, msg) {
              if (err) {
                console.log("error deleting request object:", err);
              }
              resolve({"message": objType + " deleted: " + objectName});
            });
          });
        }
      });
    };

    //if the deployment exists, get it so we can set it to 0 replicas
    deleteKubeAPI.delObj.get(objectName, function (err, data) {
      if (err && err.statusCode != 404) {
        //something is wrong, bail
        reject({"message": "Error getting " + objType + ": " + objectName + " " + err});
      } else if (err && err.statusCode == 404) {
        //already gone, nothing to do here
        resolve({"message": objType + " did not exist: " + objectName});
      } else {
        //collect deployment object and update to 0 replicas
        objectJSON = JSON.parse(JSON.stringify(data));

        if (objType == "deployments") {
          objectJSON.spec.replicas = 0;
          exports.ensureObject(objectJSON, ConnectParams, objType, reqdata, function(err, data) {
            if (err) {
              if (err.statusCode == 409) {
                exports.deleteObject(objectName, apiConnectParams, objType, reqdata)
                  .then(function (data) {resolve(data); })
                  .catch((err) => { reject(err); });
              } else {
                reject({"message": "Error updating " + objType + " to 0 replicas: " + objectName + " " + err});
              }
            } else {
              //the timeout here gives k8s time it needs to remove the replicas
              //without it they are orphaned
              setTimeout(function(){
                deleteFunc();
              }, 10000);
            }
          });
        } else {
          deleteFunc();
        } 
      }
    });
  });
};

exports.deleteService = function (serviceName, apiConnectParams, callback) {
  var deleteServiceKubeAPI = {};
  deleteServiceKubeAPI = new k8s(apiConnectParams);
  
  deleteServiceKubeAPI.services.delete(serviceName, function (err, data) {
    if (err && err.statusCode != 404) {
      return callback(err, {"message": "Error deleting service: " + serviceName + " " + err});
    } else if (err && err.statusCode == 404) {
      return callback(null, {"message": "Service not found: " + serviceName});
    } else {
      return callback(null, {"message": "Service deleted: " + serviceName});
    }
  });
};

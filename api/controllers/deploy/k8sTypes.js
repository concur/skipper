"use strict";

var _ = require('lodash');
var k8sHelper = require('./k8sHelper');
var config = require('../../../default/config');

exports.getKind = function(reqdata) {
  var ktype = this.types(reqdata);
  if (ktype[reqdata.type] == null) {
    ktype[reqdata.type] = {};
  }
  return ktype[reqdata.type];
};

exports.setrcjson = function (reqdata) {
  var kubeObjJson = 
        {
          "metadata": {
            "annotations": reqdata.annotations,
            "name": reqdata.name,
            "namespace": reqdata.namespace
          }
        };
  var kind = this.getKind(reqdata);
  var tmpJson = JSON.parse(JSON.stringify(kind));

  console.log(reqdata.key, "Type:", reqdata.type);

  if (_.has(reqdata, 'containers[0]')) {
    //set version tag
    tmpJson.spec.template.metadata.labels.version = reqdata.version;

    //set group selector if it exists
    if (reqdata.targetGroup != "" && reqdata.targetGroup != null) {
      kubeObjJson.metadata.name = reqdata.name + "-" + reqdata.targetGroup;
      tmpJson.spec.template.metadata.labels.group = reqdata.targetGroup;
    }

    if (reqdata.imagePullSecrets != "" && reqdata.imagePullSecrets != null) {
      tmpJson.spec.template.spec.imagePullSecrets = [];
      tmpJson.spec.template.spec.imagePullSecrets.push({name: reqdata.imagePullSecrets});
    }

    //set replicas if it exists
    if (reqdata.replicas != "" && reqdata.replicas != null) {
      tmpJson.spec.replicas = reqdata.replicas;
    }
  }
  
  //set override spec last
  _.merge(tmpJson, reqdata.k8s);
  
  _.merge(kubeObjJson, tmpJson);
  
  //get kind
  reqdata.kind = JSON.parse(JSON.stringify(kind));

  //for each container
  if (reqdata.kind.containerSpec) {
    for (var i = 0; i < reqdata.containers.length; i++) {
      k8sHelper.handleContainerParams(reqdata.healthCheck, reqdata.containers[i], kubeObjJson, "containers");
    }
    for (var i = 0; _.isArray(reqdata.initContainers) && i < reqdata.initContainers.length; i++) {
      k8sHelper.handleContainerParams(reqdata.healthCheck, reqdata.initContainers[i], kubeObjJson, "initContainers");
    }
  }

  reqdata.kubercjson = kubeObjJson;
  
};

exports.setsvcjson = function (reqdata) {
  reqdata.kubesvcjson = 
    {
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "annotations": reqdata.annotations,
        "name": reqdata.name,
        "labels": {
          "service": reqdata.name
        }
      },
      "spec": {
        "ports": [
          {
            "port": reqdata.targetPort,
            "targetPort": reqdata.targetPort
          }
        ],
        "selector": {
          "service": reqdata.name
        },
        "type": reqdata.serviceType
      }
    }; 

    //set group selector if it exists
    if (reqdata.targetGroup != "" && reqdata.targetGroup != null) {
      reqdata.kubesvcjson.spec.selector.group = reqdata.targetGroup;
    }
}

exports.types = function (reqdata) {
  if (reqdata == null) {
    console.log("reqdata == null", new Error().stack);
    return {};
  }
  var ktype = [];
  ktype.configmaps = {
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "prefix": "api",
    "containerSpec": false,
    "spec": {}
  };

  ktype.deployments = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Deployment",
    "prefix": "apis",
    "containerSpec": true,
    "spec": {
      "replicas": 2,
      "strategy": {
        "type": "RollingUpdate",
        "rollingUpdate": {
          "maxUnavailable": "30%",
          "maxSurge": "60%"
          },
        },
      "selector": {
        "matchLabels": {
          "service": reqdata.name,
        }
      },
      "template": {
        "metadata": {
          "labels": {
            "build": reqdata.build,
            "service": reqdata.name,
            "group": "green"
          },
          "name": "mytemplate-" + reqdata.name
        },
        "spec": {
          "containers": []
        }
      }
    }
  };

  ktype.daemonsets = {
    "apiVersion": "extensions/v1beta1",
    "kind": "DaemonSet",
    "prefix": "apis",
    "containerSpec": true,
    "spec": {
      "replicas": 2,
      "template": {
        "metadata": {
          "labels": {
            "build": reqdata.build,
            "service": reqdata.name,
            "group": "green"
          },
          "name": "mytemplate-" + reqdata.name
        },
        "spec": {
          "containers": []
        }
      }
    }
  };

  ktype.destinationpolicies = {
    "apiVersion": "config.istio.io/v1alpha2",
    "kind": "DestinationPolicy",
    "prefix": "apis",
    "containerSpec": false,
    "namespaced": true,
    "spec": {}
  };

  ktype.horizontalpodautoscalers = {
    "apiVersion": "autoscaling/v1",
    "kind": "HorizontalPodAutoscaler",
    "prefix": "apis",
    "containerSpec": false,
    "namespaced": true,
    "spec": {
      "scaleTargetRef": {
        "apiVersion": "extensions/v1beta1",
        "kind": "Deployment",
        "name": reqdata.name,
      },
      "minReplicas": 1,
      "maxReplicas": 10,
      "targetCPUUtilizationPercentage": 50
//        "metrics": [
//          {
//            "type": "Resource",
//            "resource": {
//              "name": "cpu",
//              "targetAverageUtilization": 50
//            }
//          }
//        ]
    }
  };

  ktype.jobs = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Job",
    "prefix": "apis",
    "containerSpec": true,
    "spec": {
      "template": {
        "metadata": {
          "labels": {
            "build": reqdata.build,
            "service": reqdata.name,
            "group": "green"
          },
          "name": "mytemplate-" + reqdata.name
        },
        "spec": {
          "restartPolicy": reqdata.restartPolicy || "OnFailure",
          "containers": []
        }
      }
    }
  };

  ktype.namespaces = {
    "apiVersion": "v1",
    "kind": "Namespace",
    "prefix": "api",
    "containerSpec": false,
    "spec": {}
  };

  ktype.secrets = {
    "apiVersion": "v1",
    "kind": "Secret",
    "prefix": "api",
    "containerSpec": false,
    "spec": {}
  };

  ktype.services = {
    "apiVersion": "v1",
    "kind": "Service",
    "prefix": "api",
    "containerSpec": false,
    "spec": {}
  };

  ktype.ingresses = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Ingress",
    "prefix": "apis",
    "containerSpec": false,
    "spec": {}
  };

  ktype.egressrules = {
    "apiVersion": "config.istio.io/v1alpha2",
    "kind": "EgressRule",
    "prefix": "apis",
    "containerSpec": false,
    "namespaced": true,
    "spec": {
      "destination": {
        "service": _.get(reqdata, 'egress.destination', reqdata.name)
      },
      "ports": _.get(reqdata, 'egress.ports', [{"port": 443, "protocol": "https"}])
    }
  };

  ktype.routerules = {
    "apiVersion": "config.istio.io/v1alpha2",
    "kind": "RouteRule",
    "prefix": "apis",
    "containerSpec": false,
    "namespaced": true,
    "spec": {}
  };

  if (typeof config.customTypes === 'function') {
     _.merge(ktype, config.customTypes(reqdata));
  }

  return ktype;
}
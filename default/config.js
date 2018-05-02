"use strict";

module.exports = {
  // domain - The default domain suffix for load balanced endpoints which will be displayed in the response.
  // This is overridded by the cluster level configuration for ingressDomain if provided.
  domain: process.env.domain || "127.0.0.1.xip.io",
  // defaultLocations - Array of locations API calls (POST/DELETE) are directed to when locations is not provided in the payload.
  defaultLocations: eval(process.env.defaultLocations) || [{"name": "minikube"}],
  // defaultHealthCheck - customize the standard health check path for all containers.
  defaultHealthCheck: process.env.defaultHealthCheck || "/",
  // dynamicServiceAnnotations - list of annotations that are added to your services at runtime.
  // These are removed before checking to see if the service is different and deciding to modify the service objects.
  dynamicServiceAnnotations: eval(process.env.dynamicServiceAnnotations) || [],
  // skipperEndpoint - Endpoint skipper is hosted at. This is used to generate links in the response data and for tests.
  skipperEndpoint: process.env.SERVICE_ENDPOINT || process.env.skipperEndpoint || "http://127.0.0.1:5000",
  // srcReplacementRepos - source strings used in repo replacement logic. 
  // The replacement value is defined in the cluster config.
  srcReplacementRepos: eval(process.env.srcReplacementRepos) || [],
  // The max number of clusters that will be deployed to in each location.
  maxClustersPerLocation: process.env.maxClustersPerLocation || 999,
  // setupLocationFilters is used by the setup api to remove clusters from 
  // the results when location and cluster are not specified.
  setupLocationFilters: eval(process.env.setupLocationFilters) || ["minikube"],
  // storage is abstracted and you can write your own plugin if desired
  // dynamodb and file storage plugins are provided
  // cluster config data is stored here as well as request and deployment objects
  storage: {
    type: process.env.storagetype || 'file',
    fileStoreLocation: process.env.storagepath || __dirname + '/../filestore/',
    skipSecrets: process.env.skipsecrets || true,
    removeAuthData: process.env.removeauthdata || true,
    dynamodb: {
      // the table must have a primary index on configitem.
      table: process.env.ddbtable || 'skipper',
      awsproxy: process.env.awsproxy || "",
      awskey: process.env.awskey || "",
      awssecret: process.env.awssecret || "",
      awsregion: process.env.awsregion || "us-west-2"
    }
  },
  test: {
    kubetoken: process.env.kubetoken || "invalidtoken",
    kubelocation: process.env.kubelocation || "minikube",
    kubecluster: process.env.kubecluster || "minikube",
    kubenamespace: process.env.kubenamespace || "default",
    mockproxy: process.env.mockproxy || ""
  },
  // cacert - root CA for the kubernetes clusters (if you have a default one for all clusters).
  // The cluster level configuration can override this value.
  cacert: process.env.cacert || "",
  // customLocationProcessingHandler is for injecting code during processing of each cluster location
  customLocationProcessingHandler: eval(process.env.customLocationProcessingHandler) || null,
  //example: export customLocationProcessingHandler='(function (action, reqdata, configLocation, kubercjson) { console.log(reqdata, "customLocationProcessingHandler: action:" + action); return; })'
  // customTypes is for adding kubernetes object types and CRDs
  //example: export customTypes='(function (reqdata) { var types = []; types.destinationpolicies = {"apiVersion": "config.istio.io/v1alpha2","kind": "DestinationPolicy","prefix": "apis","containerSpec": false,"namespaced": true,"spec": {}}; return types; })'
  customTypes: eval(process.env.customTypes) || null,
  // customValidateUpdateIndex can inject custom code for object POST requests
  customValidateUpdateIndex: eval(process.env.customValidateUpdateIndex) || null,
  //example export customValidateUpdateIndex='(function (reqdata) { console.log(reqdata.key, "customValidateUpdateIndex:", reqdata.type); return; })'
  customValidateDestroy: eval(process.env.customValidateDestroy) || null
  //example export customValidateDestroy='(function (reqdata) { console.log(reqdata.key, "customValidateDestroy:", reqdata.type); delete reqdata.key; return; })'
}
"use strict";

var async = require('async');
var config = require('../../default/config');
var store = require('./store/exports');
var k8sHelper = require('./deploy/k8sHelper');

//delete a deployment group on all clusters for the location specified
exports.destroy = function (req, res) {

  var reqdata = JSON.parse(JSON.stringify(req.body)), k8sclusters = {}, kapiDel = {};
  reqdata.version = Date.now();

  async.series(
    [ //validation of api parameters
      function (callback) {
        k8sHelper.validate.validateDestroy(reqdata, function (err, data) {
          return callback(err, data);
        });
      },
      // get k8s cluster config
      function (callback) {
        store.getJSON("k8sclusters", function (err, data) {
          k8sclusters = data;
          if (err) {
            console.log(reqdata.key, err);
            var code = 500, msg = 'error getting k8s clusters from db: ' + err;
          }
          return callback(code, msg);
        });
      },
      //iterate over kubernetes clusters and run api calls to k8s as needed
      //update the database so users can see the deployment log
      function (runAPICalls) {
        // iterate over each requested location
        async.eachSeries(reqdata.locations, function (location, reqLocationSeries) {
          var deployedClusters = 0;

          console.log(reqdata.key, "locationkey:", location.name);
          
          //iterate over each possible deployment location running add/remove where appropriate
          async.eachSeries(k8sclusters.locations, function (configLocation, configLocationSeries) {
            if (location.name != configLocation.location) {
              return configLocationSeries(null, "location does not match deployment");
            }
              
            var clusterAction = "", deleteAPI = true;
            clusterAction = k8sHelper.process.getClusterAction(deployedClusters, reqdata.clusters, location.clusters, configLocation.context, deleteAPI);
            
            k8sHelper.process.applyActionForLocation(reqdata, clusterAction, configLocation, function (err, data) {
              if (!err && clusterAction == "delete") {
                deployedClusters++;
              }
              return configLocationSeries(err, null);
            });
            
          }, function (err) {
            return reqLocationSeries(err, "done with each location");
          });
        }, function (err) {
          if (err) {
            return runAPICalls(err, "error when processing locations.");
          }
          reqdata.message = 'done processing.';
          return runAPICalls(null, "completed deployment API calls, check deleteClusters.");
        });
      }
    ], function (err, results) {
      k8sHelper.validate.handleResponse(reqdata, res, err || 200, results);
  });
}

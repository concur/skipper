'use strict';

var async = require('async');
var config = require('../../default/config');
var store = require('./store/exports');

function match(str, rule) {
  return new RegExp("^" + rule.split("*").join(".*") + "$").test(str);
}

// Get a setup script
exports.getSetup = function (req, res) {
  // Params
  // token: "string" // required
  // namespace: "string" //required
  // context: "string" optional for getting the config for a specific namespace
  // location: "string" optional for getting the config for a specific location
  
  var reqdata = JSON.parse(JSON.stringify(req.body));
      
  if (reqdata.token == null || reqdata.token == "") {
    res.status(422).json({err: true, result: {message: 'Missing required field: token'}});
    return;
  }

  if (reqdata.namespace == null || reqdata.namespace == "") {
    res.status(422).json({err: true, result: {message: 'Missing required field: namespace'}});
    return;
  }
  reqdata.kubeuser = reqdata.namespace;
  
if (reqdata.location != null && reqdata.location != "") {
    //append location to user
    reqdata.kubeuser = reqdata.namespace + reqdata.location
  }
  
async.series(
    [
      function (callback) {
        store.getJSON("k8sclusters", function (err, data) {
          if (err) {
            console.log(err);
            res.json({err: true, result: 'error getting k8s clusters from db: ' + err});
            return;
          } else {
            req.k8sclusters = data;
            callback(null, "k8sclusters retrieved");
          }
        });
      },
      function (callback) {
        var fullUrl = req.protocol + '://' + req.get('host'), i = 0, result = "#!/bin/bash\n\n", cert = "";

        //set credentials into the kubeconfig file
        result = result + "kubectl config set-credentials " + reqdata.kubeuser + " --token=" + reqdata.token + "\n";
        result = result + "if [ \"$(base64 -D <<< dGVzdAo= 2> /dev/null)\" == \"test\" ]; then  export basecmd=\"base64 -D\"; else  export basecmd=\"base64 -d\"; fi\n"
        CLUSTERS: //loop label
        for (i = 0; i < req.k8sclusters.locations.length; i++) {
          // handle context parameter if specified
          if (reqdata.context != null && reqdata.context != "") {
            if (req.k8sclusters.locations[i].context != reqdata.context) {
              continue;
            }
          }
          // handle location parameter if specified
          if (reqdata.location != null && reqdata.location != "") {
            if (req.k8sclusters.locations[i].location != reqdata.location) {
              continue;
            }
          }
          
          //filter out setup locations if context and location are not specified
          if (reqdata.location == null && reqdata.context == null && config.setupLocationFilters instanceof Array && config.setupLocationFilters.length > 0) {
            for (var filter = 0; filter < config.setupLocationFilters.length; filter++) {
              if (match(req.k8sclusters.locations[i].location, config.setupLocationFilters[filter])) {
                console.log("Setup Location:", req.k8sclusters.locations[i].location, "Filtered by:", config.setupLocationFilters[filter]);
                continue CLUSTERS; 
              }
            }
          }
          
          cert = req.k8sclusters.locations[i].cacert || config.cacert;

          result = result + "echo \"" + Buffer.from(cert, 'base64') + "\" > /tmp/cert.txt\n"
          result = result + "kubectl config set-cluster " + req.k8sclusters.locations[i].context + " --certificate-authority=\"/tmp/cert.txt\" --server=\"" + req.k8sclusters.locations[i].server + "\" --embed-certs=true" + "\n"
          result = result + "kubectl config set-context " + req.k8sclusters.locations[i].context + " --user=" + reqdata.kubeuser + " --namespace=" + reqdata.namespace + " --cluster=" + req.k8sclusters.locations[i].context + "\n"
          result = result + "kubectl config use-context " + req.k8sclusters.locations[i].context + "\n"
          result = result + "kubectl version\n\n"
          result = result + "echo ''\n"
        }
        
        res.format({'text/plain': function(){
          res.send(result);
          }
        });
      }
    ]);
};


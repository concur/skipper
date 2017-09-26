# Skipper - Container Deployment API
Skipper will command your fleet of k8s clusters. 

## Features

Decoupled deployments to locations instead of specific clusters.

Deploy using base level primitives (image, #containers, port, etc) without needing to craft the full set of k8s resource yaml/json.

Allows cluster administrators to provide location\cluster specific defaults for environment variables, ingress\loadbalancer domain names, docker registry locations, etc.

Allows cluster administrators to move clusters in and out of service without the need to make changes to your code pipeline and release process.

## API Documentation

Swagger UI: $SkipperEndpoint/docs

Swagger json: $SkipperEndpoint/apidocs

## Setup API

This API is used to automatically configure kubectl on your local machine. It outputs the kubectl commands necessary to add in the cluster configuration that is stored and maintained by operations. As these clusters change you can rerun the setup command to get the updates.

### Setup all Clusters

NOTE: minikube is filtered by default so can't accidentally remove your local client certificate key configuration.

`$ curl -H "Content-Type: application/json" -X GET -d '{"namespace": "yournamespace", "token": "REDACTED"}' $SkipperEndpoint/api/setup | /bin/bash`

### Specific Location

```text
$ curl -H "Content-Type: application/json" -X GET -d '{"namespace": "mynamespace", "token": "eyJh...", "location": "europe"}' $SkipperEndpoint/api/setup | /bin/bash

User "mynamespaceeurope" set.
test
Cluster "europe1" set.
Context "europe1" created.
Switched to context "europe1".
Client Version: version.Info{Major:"1", Minor:"7", GitVersion:"v1.7.0", GitCommit:"d3ada0119e776222f11ec7945e6d860061339aad", GitTreeState:"clean", BuildDate:"2017-06-29T23:15:59Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"darwin/amd64"}
Server Version: version.Info{Major:"1", Minor:"7", GitVersion:"v1.7.0", GitCommit:"d3ada0119e776222f11ec7945e6d860061339aad", GitTreeState:"clean", BuildDate:"2017-06-29T23:15:59Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"darwin/amd64"}

$ kubectl get pods
...
```

## v1/object vs v1/deployment API

They are the same but v1/object also expects a "type" parameter in the root level 
of the JSON that can be one of the following values. The v1/deployment API defaults 
an object type of 'deployments'.

- daemonsets
- deployments
- configmaps
- secrets
- jobs

If you need a new k8s object type they are easy to add into `./api/controllers/deploy/k8sTypes.js`.

End users can override any generated k8s spec using the "k8s" parameter. 
Content there will be applied on top of the location specific generated values. 
Any matching keys\fields will replace the generated values.

## Example API calls
### Create vault secret in all us clusters

`curl -H "Content-Type: application/json" -X POST -d '{"type": "secrets", "name": "vault", "locations":[{"name": "us"}], "token": "REDACTED", "namespace": "default", "k8s": { "data": { "auth": "NTQwNzk4RkMtMTg1NS00QjA4LTg4NDQtRkZBS0VUT0tFTkZGCg==" } }}' $SkipperEndpoint/api/v1/object`

### Create vault secret in all europe clusters
`curl -H "Content-Type: application/json" -X POST -d '{"type": "secrets", "name": "vault", "locations":[{"name": "europe"}], "token": "REDACTED", "namespace": "default", "k8s": { "data": { "auth": "QUJFNEFBRjItNkY5Mi00RjM2LThGMzMtNkVGNDBCMDM4NkYxCg==" } }}' $SkipperEndpoint/api/v1/object`

### Run a deployment that uses the secret above in both locations
`curl -k -H "Content-Type: application/json" -X POST -d '{"containers":[{"name": "tinynode", "image": "treeder/tiny-node:latest", "port": 8080, "secretEnv": [{"secret": "vault", "key": "auth", "env": "VAULT_TOKEN"}]}], "name": "mydeployment", "targetPort": 8080, "locations":[{"name": "us"}, {"name": "eur"}], "token": "REDACTED", "namespace": "default", "loadBalanced":true, "healthCheck": "http", "replicas": 1}' $SkipperEndpoint/api/v1/deployment`

### Delete the deployment in both locations
`curl -k -H "Content-Type: application/json" -X DELETE -d '{"name": "mydeployment", "locations":[{"name": "us"}, {"name": "eur"}], "token": "REDACTED", "namespace": "default", "removeService":true}' $SkipperEndpoint/api/v1/deployment`

### Create configmap

Notice the use of the k8s parameter to pass data through to the kubernetes directly.

`curl -H "Content-Type: application/json" -X POST -d '{"type": "configmaps", "name": "mydeployment", "token": "REDACTED", "namespace": "default", "k8s": { "data": { "mydata": "Y2VudHJhbC1hcmNoaXRlY3R1cmU=" } }, "clusters":2}' $SkipperEndpoint/api/v1/object`

### Delete configmap

`curl -H "Content-Type: application/json" -X DELETE -d '{"type": "configmaps", "name": "mydeployment", "token": "REDACTED", "namespace": "default", "clusters":2}' $SkipperEndpoint/api/v1/object`

### Create secret

Notice the use of the k8s parameter to pass data through to the kubernetes directly.

`curl -H "Content-Type: application/json" -X POST -d '{"type": "secrets", "name": "mydeployment", "token": "REDACTED", "namespace": "default", "k8s": { "data": { "mydata": "Y2VudHJhbC1hcmNoaXRlY3R1cmU=" } }, "clusters": 1}' $SkipperEndpoint/api/v1/object`

### Delete secret

`curl -H "Content-Type: application/json" -X DELETE -d '{"type": "secrets", "name": "mydeployment", "token": "REDACTED", "namespace": "default", "clusters": 1}' $SkipperEndpoint/api/v1/object`

### Deployment without service

`curl -H "Content-Type: application/json" -X POST -d '{"type": "deployments", "containers":[{"name": "mydeployment", "image": "treeder/tiny-node:latest", "port": 8080, "env":[{"name": "VAR1", "value": "test"}]}], "name": "mydeployment", "token": "REDACTED", "namespace": "default", "healthCheck": "http", "clusters":2, "replicas": 1}' $SkipperEndpoint/api/v1/object`

### Daemonset without service

`curl -H "Content-Type: application/json" -X POST -d '{"type": "daemonsets", "containers":[{"name": "mydeployment", "image": "treeder/tiny-node:latest", "port": 8080, "env":[{"name": "VAR1", "value": "test"}]}], "name": "mydeployment", "token": "REDACTED", "namespace": "default", "healthCheck": "http", "clusters":2, "replicas": 1}' $SkipperEndpoint/api/v1/object`

### Delete daemonset

`curl -H "Content-Type: application/json" -X DELETE -d '{"type": "daemonsets", "name": "mydeployment", "token": "REDACTED", "namespace": "default", "healthCheck": "http", "clusters":2, "replicas": 1}' $SkipperEndpoint/api/v1/object`

### Job without service

`curl -H "Content-Type: application/json" -X POST -d '{"type": "jobs", "containers":[{"name": "mydeployment", "image": "treeder/tiny-node:latest", "port": 8080, "env":[{"name": "VAR1", "value": "test"}]}], "name": "mydeployment", "token": "REDACTED", "namespace": "default", "healthCheck": "http", "clusters": 1, "replicas": 1}' $SkipperEndpoint/api/v1/object`

### Delete job

`curl -H "Content-Type: application/json" -X DELETE -d '{"type": "jobs", "name": "mydeployment", "token": "REDACTED", "namespace": "default", "healthCheck": "http", "clusters": 1, "replicas": 1}' $SkipperEndpoint/api/v1/object`

### Custom k8s spec for a container

`curl -H "Content-Type: application/json" -X POST -d '{"type": "deployments", "containers":[{"name": "mydeployment1", "image": "treeder/tiny-node:latest", "port": 8080, "k8s": {"lifecycle": {"postStart": {"exec": {"command": ["/bin/sh", "-c", "echo 10.205.12.122 www.concursolutions.com >> /etc/hosts"]}}}}}], "name": "mydeployment", "token": "REDACTED", "namespace": "default", "healthCheck": "http", "clusters": 1, "replicas": 1}' $SkipperEndpoint/api/v1/object`

## Default Environment Variables

These environment variables at set automatically at deploy time and are available 
to your containers at runtime. The values are allowed to be overridden if provided. 
Your administrator can also configure additional custom default environment variables 
when registering clusters.

### SERVICE_ENDPOINT

Set to the External URL that can be used to reach your own service through load balancing or ingress. 
This follows the following naming convention: "$name-$namespace.$ingressdomain || $clusterdomain || $configdomain"

### LOCATION

Set to the name of the location that was deployed to.

### K8SCONTEXT

Set to the cluster context name that the container is running in. 
See the list of clusters for more details.

## additional examples
### Deploy two copies of a container to one cluster in every location and tie it into the available load balancing (LoadBalancer or Ingress)
```
{
  "name": "mydeployment", 
  "namespace": "default", 
  "token": "REDACTED", 
  "loadBalanced": true, 
  "targetPort": 8080, 
  "clusters": 1, 
  "replicas": 2, 
  "healthCheck": "http", 
  "containers": [
    { "name": "tinynode", 
      "image": "treeder/tiny-node:latest", 
      "port": 8080}
      ]
  }
```

### Deploy two copies (replicas) of a container to each cluster in the test location and use load balancing available (LoadBalancer or Ingress)
```
{
  "name": "mydeployment", 
  "namespace": "default", 
  "token": "REDACTED", 
  "loadBalanced": true, 
  "targetPort": 8080, 
  "locations": [{"name": "test"}],
  "replicas": 2, 
  "healthCheck": "http", 
  "containers": [
    { "name": "tinynode", 
      "image": "treeder/tiny-node:latest", 
      "port": 8080}
      ]
  }
```

### Deploy to a specific k8s cluster in a specific location (not recommended since cluster names may change)
```
{
  "name": "mydeployment", 
  "namespace": "default", 
  "token": "REDACTED", 
  "loadBalanced": true, 
  "targetPort": 8080, 
  "locations": [{"name": "prod", "clusters": ["prodcluster3"]}],
  "replicas": 2, 
  "healthCheck": "http", 
  "containers": [
    { "name": "tinynode", 
      "image": "treeder/tiny-node:latest", 
      "port": 8080,
      "env": [{"name": "NODE_ENV", "value": "production"}]
    }
   ]
  }
```

### Additional optional parameters

"imagePullSecrets": "name of the secret in your namespace that has the login information to a container registry"

**# apply annotations to services and deployments**  <br>
"annotations": {"name": "value", "name2": "value2"} <br>

**# pass json data directly to all kubernetes clusters** <br>
"k8s": {ANY VALID JSON} <br>

<dl>
"containers": [{ <br>
  "name": "tinynode", <br>
  "image": "treeder/tiny-node:latest", <br><br>
  "k8s": {ANY VALID JSON}, <br>
  <b># multiple ports can be specified</b><br>
  "port": [80, 443, 12345], <br><br>
  <b># command can be overridden in the container</b> <br>
  "command": ["/mycommand", "param1", "param2"],<br><br>
  <b># emptyDir volumes can be provisioned across containers</b> <br>
  "emptyDir": "/mydirectory", //directory to mount empty local volumes, can be different across pods but will share data<br><br>
  <b>//list additional linux capabilities for this container, for example: "DAC_READ_SEARCH"</b><br>
  "capabilities": ["IPC_LOCK", ...], <br> <br>
  <b># min/max memory and cpu limits can be specified</b><br>
  "mincpu": "300m", <br>
  "maxcpu": "500m", <br>
  "minmem": "100Mi", <br>
  "maxmem": "200Mi", <br> <br>
  <b># readiness/liveness settings can be overridden</b> <br>
  "periodSeconds": 20, //change the check interval in seconds for both probes - default = 10<br>
  "readinessPeriodSeconds": 30, //change the check interval in seconds for the readiness probe - default = 10<br>
  "livenessPeriodSeconds": 30, //change the check interval in seconds for the liveness probe - default = 10<br>
  "failureThreshold": 1, //change the number of attempts before considered failed for both probes - default = 3<br>
  "readinessFailureThreshold": 1, //change the number of attempts before considered failed for readiness probe - default = 3<br>
  "livenessFailureThreshold": 1, //change the number of attempts before considered failed for liveness probe - default = 3<br><br>
  <b># secret mount can be specified to mount secrets in a directory</b> <br>
  "secretmount": {  <br><br>
  <dd>
  <b># name of the secret resource in your namespace to mount</b>  <br>
    "secret": "mysecretstore",  <br><br>
    <b># location to mount it in inside your container</b> <br>
    "mountpath": "/myvolume"  <br>
    } <br> <br>
     </dd>
  <b># Use a configmap item for an environment variable in the container</b>  <br>
  "secretEnv": [{  <br><br>
  <dd>
  <b># name of the secret resource in your namespace to use</b>  <br>
    "secret": "consul",  <br><br>
    <b># name of the key in the secret to map to an environment variable</b> <br>
    "key": "public.resource.value",  <br>
    <b># name of the environment variable that will be set using the value from the key</b> <br>
    "env": "MyENV"  <br>
    }] <br>
     </dd>
  <b># Mount a configmap into the container</b>  <br>
  "configMapMount": [{  <br><br>
  <dd>
  <b># name of the configmap resource in your namespace to mount</b>  <br>
    "configMap": "consul",  <br><br>
    <b># location to mount it in inside your container</b> <br>
    "mountPath": "/myvolume"  <br>
    }] <br> <br>
     </dd>
  <b># Use a configmap item for an environment variable in the container</b>  <br>
  "configMapEnv": [{  <br><br>
  <dd>
  <b># name of the configmap resource in your namespace to use</b>  <br>
    "configMap": "consul",  <br><br>
    <b># name of the key in the file to map to an environment variable</b> <br>
    "key": "public.resource.value",  <br>
    <b># name of the environment variable that will be set using the value from the key</b> <br>
    "env": "MyENV"  <br>
    }] <br>
     </dd>
}]
</dl>
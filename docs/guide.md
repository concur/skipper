# Quick Walkthough

This guide will walk you through an example of how to use Skipper. Minikube will be used to run Skipper and will also be configured as a target for skipper deployments. Multiple simulated locations and destination clusters will be configured, however, they will all target the same Minikube cluster in this example.

In the real world, you would define all of your own internal Kubernetes clusters and locations.

A location is a unique deployment target. It could be any environmental segmentation that changes slowly or not at all. Locations are used as targets for all commands through Skipper. Skipper also accepts a list of default deployment locations as startup config.

Locations could be...
- a cloud region or availability zone.
- a development lifecycle like dev/qa/prod.
- really anything but put some thought into what standard you define because they should not change often or at all if possible.

## 1. Start Minikube & Enable Ingress

This guide assumes that you have [minikube](https://kubernetes.io/docs/getting-started-guides/minikube/) started and the ingress addon enabled.

```
minikube start
minikube addons enable ingress
```

### 1b. Get your minikube access token from the default service account

This token will be used in the api calls to Skipper later on.

```
export kubetoken=$(kubectl get secrets $(kubectl get secrets | grep default | grep service-account-token | awk '{print $1}') -o jsonpath='{.data.token}' | base64 -d)
```

- note that some versions of the base64 command require "-D" instead of "-d" to decode the input

## 2. Run Skipper

Follow the steps to [Run Skipper on minikube](../README.md#run-skipper-on-minikube)

## 3. Add Clusters and Locations to Skipper

```
#US Clusters
curl -H "Content-Type: application/json" -X POST -d '{"server": "https://kubernetes", "registry": "us.dockerregistry", "cacert": "'"$(cat ~/.minikube/ca.crt | base64 | tr -d '\r\n')"'", "context": "us1", "location": "us", "ingressDomain": "us.192.168.99.100.xip.io", "defaultENV":[{"name": "PROXY", "value": "https://secure.us.proxy.local:1234/"},{"name": "NODE_ENV", "value": "PROD"}]}' $SkipperEndpoint/api/v1/config/cluster
curl -H "Content-Type: application/json" -X POST -d '{"server": "https://kubernetes", "registry": "us.dockerregistry", "cacert": "'"$(cat ~/.minikube/ca.crt | base64 | tr -d '\r\n')"'", "context": "us2", "location": "us", "ingressDomain": "us.192.168.99.100.xip.io", "defaultENV":[{"name": "PROXY", "value": "https://secure.us.proxy.local:5678/"},{"name": "NODE_ENV", "value": "PROD"}]}' $SkipperEndpoint/api/v1/config/cluster

#EUR Clusters
curl -H "Content-Type: application/json" -X POST -d '{"server": "https://kubernetes", "registry": "eur.dockerregistry.local", "cacert": "'"$(cat ~/.minikube/ca.crt | base64 | tr -d '\r\n')"'", "context": "eur1", "location": "europe", "ingressDomain": "eur.192.168.99.100.xip.io", "defaultENV":[{"name": "PROXY", "value": "https://secure.eur.proxy.local:2233/"},{"name": "NODE_ENV", "value": "PROD"}]}' $SkipperEndpoint/api/v1/config/cluster
curl -H "Content-Type: application/json" -X POST -d '{"server": "https://kubernetes", "registry": "eur.dockerregistry.local", "cacert": "'"$(cat ~/.minikube/ca.crt | base64 | tr -d '\r\n')"'", "context": "eur2", "location": "europe", "ingressDomain": "eur.192.168.99.100.xip.io", "defaultENV":[{"name": "PROXY", "value": "https://secure.eur.proxy.local:5566/"},{"name": "NODE_ENV", "value": "PROD"}]}' $SkipperEndpoint/api/v1/config/cluster
```

### List out current cluster config

```
curl $SkipperEndpoint/api/v1/config/cluster | jq .
```

## 4. Deploy Services using the Skipper API

### 4a. Create different secrets in each location

```
curl -H "Content-Type: application/json" -X POST -d '{"type": "secrets", "name": "vault", "locations":[{"name": "us"}], "token": "'"${kubetoken}"'", "namespace": "default", "k8s": { "data": { "auth": "NTQwNzk4RkMtMTg1NS00QjA4LTg4NDQtRkZBS0VUT0tFTkZGCg==" } }}' $SkipperEndpoint/api/v1/object
curl -H "Content-Type: application/json" -X POST -d '{"type": "secrets", "name": "vault", "locations":[{"name": "europe"}], "token": "'"${kubetoken}"'", "namespace": "default", "k8s": { "data": { "auth": "QUJFNEFBRjItNkY5Mi00RjM2LThGMzMtNkVGNDBCMDM4NkYxCg==" } }}' $SkipperEndpoint/api/v1/object
```

You should see a responses like the one below.

Notice that the secret was created on both the clusters in the `us` location.

Notice that the secret data and kubernetes auth token are NOT included in the response data.
They are also not included in any logs or stored configuration unless overridden in the startup parameters.

```
{"type":"secrets","name":"vault","locations":[{"name":"us"}],"token":"REDACTED","namespace":"default","k8s":{"data":{"REDACTED":"true"}},"deployClusters":[{"message":"secrets created: vault","location":"us","context":"us1"},{"message":"secrets updated: vault","location":"us","context":"us2"}],"deleteClusters":[],"endpoints":{"us":{}},"message":"done processing.","err":false,"result":{"message":"completed deployment API calls, check deployClusters."}}
```

Remember in this example all commands are actually going to the single minikube cluster, so there is still only one copy of the secret.

```
kubectl get secrets
```

### 4b. Run a deployment in all us and europe clusters that use the secret

```
curl -k -H "Content-Type: application/json" -X POST -d '{"containers":[{"name": "tinynode", "image": "tutum/hello-world", "port": 80, "secretEnv": [{"secret": "vault", "key": "auth", "env": "VAULT_TOKEN"}]}], "name": "mydeployment", "targetPort": 80, "locations":[{"name": "us"}, {"name": "europe"}], "token": "'"${kubetoken}"'", "namespace": "default", "loadBalanced":true, "healthCheck": "http", "replicas": 1}' $SkipperEndpoint/api/v1/deployment
```

Notice the data in the output about the various location that were deployed to.

```
"deployClusters":[{"message":"deployments updated: mydeployment","location":"us","context":"us1"}...]
```

As well as the endpoints where these deployment details are stored in skipper for each location

```
"this":"https://skipper.192.168.99.100.xip.io/api/v1/deployment/history.europe.default.deployments_mydeployment.1506035747159"

"latest":"https://skipper.192.168.99.100.xip.io/api/v1/deployment/current.europe.default.deployments_mydeployment"
```

And lastly the endpoint where the service can be reached for each location

```
"url":"https://mydeployment-default.eur.192.168.99.100.xip.io"
```


### 4c. Look at the objects created in k8s

```
kubectl get svc,ing,deploy mydeployment

NAME               CLUSTER-IP   EXTERNAL-IP   PORT(S)        AGE
svc/mydeployment   10.0.0.72    <pending>     80:30046/TCP   4m

NAME               HOSTS                                            ADDRESS          PORTS     AGE
ing/mydeployment   mydeployment-default.eur.192.168.99.100.xip.io   192.168.99.100   80, 443   4m

NAME                  DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
deploy/mydeployment   1         1         1            1           4m
```

### 4d. Access the running service using the ingress endpoint

https://mydeployment-default.eur.192.168.99.100.xip.io

## 5. Delete the deployment in both locations

```
curl -k -H "Content-Type: application/json" -X DELETE -d '{"name": "mydeployment", "locations":[{"name": "us"}, {"name": "europe"}], "token": "'"${kubetoken}"'", "namespace": "default", "removeService":true}' $SkipperEndpoint/api/v1/deployment
```

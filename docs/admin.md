## Review Configuration

The configuration defaults and inline documentation are stored in [./default/config.js](https://github.com/concur/skipper/blob/master/default/config.js).
All options can be configured with environment variables.

## Run Skipper

See [README.md](../README.md)

## Cluster Config API

This API is used to list, add or remove kubernetes clusters that can then be used by Skipper.

### List Clusters

`curl $SkipperEndpoint/api/v1/config/cluster | jq .`

### Add\Update Cluster

The primary key is the cluster context.
This example allows deployment to minikube from Skipper running on minikube which would only be useful for local development. Where Skipper becomes useful is when you have locations for various regions or jurisdictions each with multiple clusters.

``curl -H "Content-Type: application/json" -X POST -d '{"server": "https://kubernetes", "registry": "yourlocaldockerregistry", "cacert": "'"$(cat ~/.minikube/ca.crt | base64)"'", "context": "minikube1", "location": "minikube", "ingressDomain": "192.168.99.100.xip.io", "defaultENV":[{"name": "foo", "value": "bar"},{"name": "NODE_ENV", "value": "TEST"}]}' $SkipperEndpoint/api/v1/config/cluster``

### Remove Cluster

`curl -H "Content-Type: application/json" -X DELETE -d '{"context": "minikube1"}' $SkipperEndpoint/api/v1/config/cluster`

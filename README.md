# Skipper - Container Deployment API

[![CircleCI](https://circleci.com/gh/concur/skipper/tree/master.svg?style=svg&circle-token=e16cb0f808bc99fe8110761056142fb78466af34)](https://circleci.com/gh/concur/skipper/tree/master)

<img src="https://user-images.githubusercontent.com/3026995/30878025-7a472d98-a2b0-11e7-804b-fcf5aa6bce3b.png" alt="skipper" width="80" height="100">
Skipper will command your fleet of k8s clusters. 

![skipper deployment 1](https://cloud.githubusercontent.com/assets/3026995/20087845/f879c3d4-a530-11e6-8415-516a4a03ad10.png)

## Features

- Provides an API to deploy onto kubernetes clusters using mostly base level primitives
(image, #containers, port, etc).
  - Kubernetes spec is created dynamically based on default values stored each clusters configuration from the [Administrator API's](./docs/admin.md).
  - The resulting spec is then applied to the destination clusters in each location
  that is being deployed to.

- Provides an API to setup local kubectl config based on available clusters.

- Decouples kubernetes deployments to locations instead of specific clusters.

- Allows cluster administrators to provide location\cluster specific defaults for environment variables, ingress\loadbalancer domain names, docker registry locations, etc.

- Allows cluster administrators to move clusters in and out of service without the need to make changes to your code pipeline and release process.

## Review Configuration

The configuration defaults and inline documentation are stored in [./default/config.js](https://github.com/concur/skipper/blob/master/default/config.js).

All options can be configured with environment variables.

## Run Skipper on kubernetes

```
#for standard use in this guide
export SkipperEndpoint=https://yourinternalskipper.com

kubectl run --port=5000 --env="skipperEndpoint=$SkipperEndpoint" skipper --image=concur/skipper:latest
kubectl expose deployment skipper --port=5000 --type=LoadBalancer
```

## Run Skipper on minikube

```
kubectl create -f ./docs/minikube/

#for standard use in this guide
export SkipperEndpoint="-k https://skipper.192.168.99.100.xip.io"
```

## Run Skipper on docker

```
#for standard use in this guide
export SkipperEndpoint=http://127.0.0.1:5000

docker run -d -p 5000:5000 concur/skipper:latest
```

Swagger UI: $SkipperEndpoint/docs

Swagger JSON: $SkipperEndpoint/apidocs


## Docs

[Walkthrough](./docs/guide.md)

[End User Guide](./docs/usage.md)

[Administrator Guide](./docs/admin.md)

[Development Guide](./docs/development.md)


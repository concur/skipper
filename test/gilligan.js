"use strict";
//the follow environment variables can be used to override defaults from config.js:
//export awskey=XXXXXXXXXHG2A
//export awssecret=XXXXXXXXXXXX
//export kubetoken=upeUXXXXXXXX
//export kubelocation=yourConfigLocation
//export kubecluster=yourConfigContext
//export kubenamespace=namespace
//export kubetoken=authtoken

let deploy = require('../app.js');
let chai = require('chai');
let chaiHttp = require('chai-http');
let should = require('should');
let config = require('../default/config.js');
let server = config.skipperEndpoint;
chai.use(chaiHttp);

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

const deployNum = 437;
var endpoints = {};

describe('deploy tests', () => {

  describe('/health', () => {
    it('it should GET /health', (done) => {
      chai.request(server)
      .get('/health')
      .end((err, res) => {
        res.status.should.be.equal(200);
        done();
      });
    });
  });

  describe('/api/v1/config/cluster', () => {
    it('it should create a cluster config - example', (done) => {
      chai.request(server)
      .post('/api/v1/config/cluster')
      .send({"registry":"mylocalregistry", "server":"http://127.0.0.1:8001", "context":"minikube","location":"minikube", "ingressDomain": "192.168.99.100.xip.io", "proxy": config.test.mockproxy, "defaultENV":[{"name":"DEFAULT", "value":"mydefault"}, {"name":"DEFAULT2", "value":"mydefault2"}]})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.property('locations');
        res.body.locations.should.be.instanceof(Array);
        res.body.locations.should.containDeep([{"registry":"mylocalregistry", "server":"http://127.0.0.1:8001", "context":"minikube", "location":"minikube", "defaultENV":[{"name":"DEFAULT", "value":"mydefault"}, {"name":"DEFAULT2", "value":"mydefault2"}]}]);
        done();
      });
    });

    it('it should GET all the clusters', (done) => {
      chai.request(server)
      .get('/api/v1/config/cluster')
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.property('locations');
        res.body.locations.should.be.instanceof(Array);
        done();
      });
    });
  });

  describe('/api/setup', () => {
    it('it should GET cluster config using location and context', (done) => {
      chai.request(server)
      .get('/api/setup')
      .send({"namespace": config.test.kubenamespace, "token": config.test.kubetoken, "location": config.test.kubelocation, "context": config.test.kubecluster})
      .end((err, res) => {
        res.status.should.be.equal(200);
        done();
      });
    });
    it('it should GET cluster config with default filters', (done) => {
      chai.request(server)
      .get('/api/setup')
      .send({"namespace": config.test.kubenamespace, "token": config.test.kubetoken})
      .end((err, res) => {
        res.status.should.be.equal(200);
        done();
      });
    });
  });

  describe('secrets api', () => {
    it('it should create a secret - example', (done) => {
      chai.request(server)
      .post('/api/v1/object')
      .set("Content-Type", "application/json")
      .send({"correlationid": "secret1", "type": "secrets", "name":"vault", "locations":[{"name":config.test.kubelocation}], "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "k8s": { "data": { "auth": "NTQwNzk4RkMtMTg1NS00QjA4LTg4NDQtRkZBS0VUT0tFTkZGCg==" } }})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['name', 'locations', 'token', 'namespace', 'k8s', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.token.should.equal('REDACTED');
        res.body.k8s.should.eql({ data: { REDACTED: 'true' } });
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
  });

  describe('configmap api', () => {
    it('it should create a config map - example - all locations', (done) => {
      chai.request(server)
      .post('/api/v1/object')
      .set("Content-Type", "application/json")
      .send({"correlationid": "configmap1", "type": "configmaps", "name":"config", "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "k8s": { "data": { "mydata": "Y2VudHJhbC1hcmNoaXRlY3R1cmU=" } }, "clusters":2})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['name', 'locations', 'token', 'namespace', 'k8s', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.token.should.equal('REDACTED');
        res.body.kubercjson.data.mydata.should.equal("Y2VudHJhbC1hcmNoaXRlY3R1cmU=");
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this']);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
  });

  describe('/api/v1/deployment', () => {
    it('it should create a deployment - specific location', (done) => {
      chai.request(server)
      .post('/api/v1/deployment')
      .set("Content-Type", "application/json")
      .send({"correlationid": "deployment1", "containers":[{"name":"mydeployment-" + deployNum, "image":"treeder/tiny-node:latest", "port": 8080, "env": [{"name": "NODE_ENV", "value": ""}], "configMapEnv": [{"configMap": "config", "key": "mydata", "env": "RABBITURL"}], "secretEnv": [{"secret": "vault", "key": "auth", "env": "VAULT_TOKEN"}], "configMapMount": [{"configMap": "config", "mountPath": "/data"}], "capabilities": ["IPC_LOCK"], "emptyDir": "/mydirectory", "secretmount": {"secret": "vault", "mountpath": "/mysecrets"}, "timeoutSeconds": 5, "readinessFailureThreshold": 6, "livenessFailureThreshold": 7, "livenessPeriodSeconds": 8, "readinessPeriodSeconds": 9, "command": ["node", "server.js"], "mincpu": "300m", "maxcpu": "500m", "minmem": "100Mi", "maxmem": "200Mi", "k8s": {"lifecycle": {"postStart": {"exec": {"command": ["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]}}}}}, {"image":"treeder/tiny-node:latest", "port": 8081, "secretmount": {"secret": "secret2", "mountpath": "/mysecrets"}}], "name":"mydeployment", "targetPort":8080, "user": config.test.kubenamespace, "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "locations": [{"name": config.test.kubelocation, "clusters": [config.test.kubecluster]}], "annotations": {"deploynum": deployNum.toString()}, "loadBalanced":false, "healthCheck":"http", "replicas":1, "terminationGracePeriodSeconds": 60}})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'annotations', 'kubesvcjson', 'kubercjson', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.annotations.should.be.instanceof(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.metadata.annotations.should.be.an.instanceOf(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.spec.template.spec.containers[0].should.have.properties(['env', 'livenessProbe', 'readinessProbe', 'ports', 'image', 'name', 'volumeMounts', 'securityContext', 'command', 'resources', 'lifecycle']);
        res.body.kubercjson.spec.template.spec.containers[0].env.should.containDeep([ { name: 'VAULT_TOKEN'}, { name: 'RABBITURL'}, { name: 'NODE_ENV'}]);
        res.body.kubercjson.spec.template.spec.containers[0].volumeMounts.should.containDeep([ { name: 'config-volume-mydeployment-' + deployNum + '-0', mountPath: '/data' }, { name: 'empty-mydeployment-' + deployNum, mountPath: '/mydirectory' }, { name: 'secret-volume-mydeployment-' + deployNum, mountPath: '/mysecrets' } ]);
        res.body.kubercjson.spec.template.spec.containers[0].livenessProbe.should.containDeep({httpGet: { path: config.defaultHealthCheck, port: 8080 }}, {timeoutSeconds: 5}, {FailureThreshold: 7}, {periodSeconds: 8});
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.path.should.equal(config.defaultHealthCheck);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.port.should.equal(8080);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.timeoutSeconds.should.equal(5);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.FailureThreshold.should.equal(6);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.periodSeconds.should.equal(9);
        res.body.kubercjson.spec.template.spec.containers[0].command.should.eql(["node", "server.js"]);
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.cpu.should.equal('300m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.memory.should.equal('100Mi');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.cpu.should.equal('500m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.memory.should.equal('200Mi');
        res.body.kubercjson.spec.template.spec.containers[0].lifecycle.postStart.exec.command.should.eql(["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]);
        res.body.kubercjson.spec.template.spec.terminationGracePeriodSeconds.should.equal(60);
        res.body.token.should.equal('REDACTED');
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this']);
        res.body.endpoints[config.test.kubelocation].should.not.have.properties(['url']);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
    it('it should create a deployment - specific location different port', (done) => {
      chai.request(server)
      .post('/api/v1/deployment')
      .set("Content-Type", "application/json")
      .send({"correlationid": "deployment2", "containers":[{"name":"mydeployment-" + deployNum, "image":"treeder/tiny-node:latest", "port": 8080, "env": [{"name": "NODE_ENV", "value": ""}], "configMapEnv": [{"configMap": "config", "key": "mydata", "env": "RABBITURL"}], "secretEnv": [{"secret": "vault", "key": "auth", "env": "VAULT_TOKEN"}], "configMapMount": [{"configMap": "config", "mountPath": "/data"}], "capabilities": ["IPC_LOCK"], "emptyDir": "/mydirectory", "secretmount": {"secret": "vault", "mountpath": "/mysecrets"}, "timeoutSeconds": 5, "readinessFailureThreshold": 6, "livenessFailureThreshold": 7, "livenessPeriodSeconds": 8, "readinessPeriodSeconds": 9, "command": ["node", "server.js"], "mincpu": "300m", "maxcpu": "500m", "minmem": "100Mi", "maxmem": "200Mi", "k8s": {"lifecycle": {"postStart": {"exec": {"command": ["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]}}}}}], "name":"mydeployment", "targetPort":3001, "user": config.test.kubenamespace, "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "locations": [{"name": config.test.kubelocation, "clusters": [config.test.kubecluster]}], "annotations": {"deploynum": deployNum.toString()}, "loadBalanced":false, "healthCheck":"http", "replicas":1, "terminationGracePeriodSeconds": 60})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'annotations', 'kubesvcjson', 'kubercjson', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.kubercjson.metadata.annotations.should.be.an.instanceOf(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.spec.template.spec.containers[0].should.have.properties(['env', 'livenessProbe', 'readinessProbe', 'ports', 'image', 'name', 'volumeMounts', 'securityContext', 'command', 'resources', 'lifecycle']);
        res.body.kubercjson.spec.template.spec.containers[0].env.should.containDeep([ { name: 'VAULT_TOKEN'}, { name: 'RABBITURL'}, { name: 'NODE_ENV'}]);
        res.body.kubercjson.spec.template.spec.containers[0].volumeMounts.should.containDeep([ { name: 'config-volume-mydeployment-' + deployNum + '-0', mountPath: '/data' }, { name: 'empty-mydeployment-' + deployNum, mountPath: '/mydirectory' }, { name: 'secret-volume-mydeployment-' + deployNum, mountPath: '/mysecrets' } ]);
        res.body.kubercjson.spec.template.spec.containers[0].livenessProbe.should.containDeep({httpGet: { path: config.defaultHealthCheck, port: 8080 }}, {timeoutSeconds: 5}, {FailureThreshold: 7}, {periodSeconds: 8});
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.path.should.equal(config.defaultHealthCheck);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.port.should.equal(8080);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.timeoutSeconds.should.equal(5);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.FailureThreshold.should.equal(6);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.periodSeconds.should.equal(9);
        res.body.kubercjson.spec.template.spec.containers[0].command.should.eql(["node", "server.js"]);
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.cpu.should.equal('300m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.memory.should.equal('100Mi');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.cpu.should.equal('500m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.memory.should.equal('200Mi');
        res.body.kubercjson.spec.template.spec.containers[0].lifecycle.postStart.exec.command.should.eql(["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]);
        res.body.kubercjson.spec.template.spec.terminationGracePeriodSeconds.should.equal(60);
        res.body.token.should.equal('REDACTED');
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this']);
        res.body.endpoints[config.test.kubelocation].should.not.have.properties(['url']);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
    it('it should create a deployment clusters = 1', (done) => {
      chai.request(server)
      .post('/api/v1/deployment')
      .set("Content-Type", "application/json")
      .send({"correlationid": "deployment3", "containers":[{"name":"mydeployment-" + deployNum, "image":"treeder/tiny-node:latest", "port": 8080, "configMapEnv": [{"configMap": "config", "key": "mydata", "env": "RABBITURL"}], "secretEnv": [{"secret": "vault", "key": "auth", "env": "VAULT_TOKEN"}], "configMapMount": [{"configMap": "config", "mountPath": "/data"}], "capabilities": ["IPC_LOCK"], "emptyDir": "/mydirectory", "secretmount": {"secret": "vault", "mountpath": "/mysecrets"}, "timeoutSeconds": 5, "readinessFailureThreshold": 6, "livenessFailureThreshold": 7, "livenessPeriodSeconds": 8, "readinessPeriodSeconds": 9, "command": ["node", "server.js"], "mincpu": "300m", "maxcpu": "500m", "minmem": "100Mi", "maxmem": "200Mi", "k8s": {"lifecycle": {"postStart": {"exec": {"command": ["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]}}}}}], "name":"mydeployment", "targetPort":3001, "user": config.test.kubenamespace, "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "locations": [{"name": config.test.kubelocation}], "clusters": 1, "annotations": {"deploynum": deployNum.toString()}, "loadBalanced":true, "healthCheck":"http", "replicas":1})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'annotations', 'kubesvcjson', 'kubercjson', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.annotations.should.be.instanceof(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.metadata.annotations.should.be.an.instanceOf(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.spec.template.spec.containers[0].should.have.properties(['env', 'livenessProbe', 'readinessProbe', 'ports', 'image', 'name', 'volumeMounts', 'securityContext', 'command', 'resources', 'lifecycle']);
        res.body.kubercjson.spec.template.spec.containers[0].env.should.containDeep([ { name: 'VAULT_TOKEN'}, { name: 'RABBITURL'}]);
        res.body.kubercjson.spec.template.spec.containers[0].volumeMounts.should.containDeep([ { name: 'config-volume-mydeployment-' + deployNum + '-0', mountPath: '/data' }, { name: 'empty-mydeployment-' + deployNum, mountPath: '/mydirectory' }, { name: 'secret-volume-mydeployment-' + deployNum, mountPath: '/mysecrets' } ]);
        res.body.kubercjson.spec.template.spec.containers[0].livenessProbe.should.containDeep({httpGet: { path: config.defaultHealthCheck, port: 8080 }}, {timeoutSeconds: 5}, {FailureThreshold: 7}, {periodSeconds: 8});
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.path.should.equal(config.defaultHealthCheck);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.port.should.equal(8080);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.timeoutSeconds.should.equal(5);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.FailureThreshold.should.equal(6);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.periodSeconds.should.equal(9);
        res.body.kubercjson.spec.template.spec.containers[0].command.should.eql(["node", "server.js"]);
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.cpu.should.equal('300m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.memory.should.equal('100Mi');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.cpu.should.equal('500m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.memory.should.equal('200Mi');
        res.body.kubercjson.spec.template.spec.containers[0].lifecycle.postStart.exec.command.should.eql(["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]);
        res.body.token.should.equal('REDACTED');
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this','url']);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
    it('it should create a deployment with initContainers', (done) => {
      chai.request(server)
      .post('/api/v1/deployment')
      .set("Content-Type", "application/json")
      .send({"correlationid": "deployment3", "containers":[{"name":"mydeployment-" + deployNum, "image":"treeder/tiny-node:latest", "port": 8080 }], "initContainers":[{"image":"lachlanevenson/k8s-kubectl:latest", "command": ["sh", "-c", "kubectl get pods"], "port": 2000, "mincpu": "300m", "maxcpu": "500m", "minmem": "100Mi", "maxmem": "200Mi"}], "name":"mydeployment", "targetPort":3001, "user": config.test.kubenamespace, "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "locations": [{"name": config.test.kubelocation}], "clusters": 1, "annotations": {"deploynum": deployNum.toString()}, "loadBalanced":true, "healthCheck":"http", "replicas":1})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'annotations', 'kubesvcjson', 'kubercjson', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.annotations.should.be.instanceof(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.metadata.annotations.should.be.an.instanceOf(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.spec.template.spec.containers[0].should.have.properties(['livenessProbe', 'readinessProbe', 'ports', 'image', 'name']);
        res.body.kubercjson.spec.template.spec.initContainers[0].should.have.properties(['env', 'ports', 'image', 'name', 'command']);
        res.body.kubercjson.spec.template.spec.initContainers[0].command.should.eql(["sh", "-c", "kubectl get pods"]);
        res.body.kubercjson.spec.template.spec.initContainers[0].resources.requests.cpu.should.equal('300m');
        res.body.kubercjson.spec.template.spec.initContainers[0].resources.requests.memory.should.equal('100Mi');
        res.body.kubercjson.spec.template.spec.initContainers[0].resources.limits.cpu.should.equal('500m');
        res.body.kubercjson.spec.template.spec.initContainers[0].resources.limits.memory.should.equal('200Mi');
        res.body.token.should.equal('REDACTED');
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this','url']);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
    it('it should create a deployment all clusters - example', (done) => {
      chai.request(server)
      .post('/api/v1/deployment')
      .set("Content-Type", "application/json")
      .send({"correlationid": "deployment4", "containers":[{"name":"mydeployment-" + deployNum, "image":"treeder/tiny-node:latest", "port": 8080, "configMapEnv": [{"configMap": "config", "key": "mydata", "env": "RABBITURL"}], "secretEnv": [{"secret": "vault", "key": "auth", "env": "VAULT_TOKEN"}], "configMapMount": [{"configMap": "config", "mountPath": "/data"}], "capabilities": ["IPC_LOCK"], "emptyDir": "/mydirectory", "secretmount": {"secret": "vault", "mountpath": "/mysecrets"}, "timeoutSeconds": 5, "readinessFailureThreshold": 6, "livenessFailureThreshold": 7, "livenessPeriodSeconds": 8, "readinessPeriodSeconds": 9, "command": ["node", "server.js"], "mincpu": "300m", "maxcpu": "500m", "minmem": "100Mi", "maxmem": "200Mi", "k8s": {"lifecycle": {"postStart": {"exec": {"command": ["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]}}}}}], "name":"mydeployment", "targetPort":8080, "user": config.test.kubenamespace, "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "locations": [{"name": config.test.kubelocation}], "annotations": {"deploynum": deployNum.toString()}, "loadBalanced":true, "healthCheck":"http", "replicas":1})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'annotations', 'kubesvcjson', 'kubercjson', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.annotations.should.be.instanceof(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.metadata.annotations.should.be.an.instanceOf(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.spec.template.spec.containers[0].should.have.properties(['env', 'livenessProbe', 'readinessProbe', 'ports', 'image', 'name', 'volumeMounts', 'securityContext', 'command', 'resources', 'lifecycle']);
        res.body.kubercjson.spec.template.spec.containers[0].env.should.containDeep([ { name: 'VAULT_TOKEN'}, { name: 'RABBITURL'}]);
        res.body.kubercjson.spec.template.spec.containers[0].volumeMounts.should.containDeep([ { name: 'config-volume-mydeployment-' + deployNum + '-0', mountPath: '/data' }, { name: 'empty-mydeployment-' + deployNum, mountPath: '/mydirectory' }, { name: 'secret-volume-mydeployment-' + deployNum, mountPath: '/mysecrets' } ]);
        res.body.kubercjson.spec.template.spec.containers[0].livenessProbe.should.containDeep({httpGet: { path: config.defaultHealthCheck, port: 8080 }}, {timeoutSeconds: 5}, {FailureThreshold: 7}, {periodSeconds: 8});
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.path.should.equal(config.defaultHealthCheck);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.port.should.equal(8080);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.timeoutSeconds.should.equal(5);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.FailureThreshold.should.equal(6);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.periodSeconds.should.equal(9);
        res.body.kubercjson.spec.template.spec.containers[0].command.should.eql(["node", "server.js"]);
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.cpu.should.equal('300m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.memory.should.equal('100Mi');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.cpu.should.equal('500m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.memory.should.equal('200Mi');
        res.body.kubercjson.spec.template.spec.containers[0].lifecycle.postStart.exec.command.should.eql(["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]);
        res.body.token.should.equal('REDACTED');
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this','url']);
        res.body.message.should.equal('done processing.');
        res.body.result.message.should.equal('completed deployment API calls, check deployClusters.');
        done();
      });
    });
    it('it should get the deployment just created', (done) => {
      chai.request(server)
      .get('/api/v1/deployment/current.' + config.test.kubelocation + '.' + config.test.kubenamespace + '.deployments_mydeployment')
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'annotations', 'kubesvcjson', 'kubercjson', 'deployClusters', 'endpoints', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.annotations.should.be.instanceof(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.metadata.annotations.should.be.an.instanceOf(Object).and.have.property('deploynum', deployNum.toString());
        res.body.kubercjson.spec.template.spec.containers[0].should.have.properties(['env', 'livenessProbe', 'readinessProbe', 'ports', 'image', 'name', 'volumeMounts', 'securityContext', 'command', 'resources', 'lifecycle']);
        res.body.kubercjson.spec.template.spec.containers[0].env.should.containDeep([ { name: 'VAULT_TOKEN'}, { name: 'RABBITURL'}]);
        res.body.kubercjson.spec.template.spec.containers[0].volumeMounts.should.containDeep([ { name: 'config-volume-mydeployment-' + deployNum + '-0', mountPath: '/data' }, { name: 'empty-mydeployment-' + deployNum, mountPath: '/mydirectory' }, { name: 'secret-volume-mydeployment-' + deployNum, mountPath: '/mysecrets' } ]);
        res.body.kubercjson.spec.template.spec.containers[0].livenessProbe.should.containDeep({httpGet: { path: config.defaultHealthCheck, port: 8080 }}, {timeoutSeconds: 5}, {FailureThreshold: 7}, {periodSeconds: 8});
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.path.should.equal(config.defaultHealthCheck);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.httpGet.port.should.equal(8080);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.timeoutSeconds.should.equal(5);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.FailureThreshold.should.equal(6);
        res.body.kubercjson.spec.template.spec.containers[0].readinessProbe.periodSeconds.should.equal(9);
        res.body.kubercjson.spec.template.spec.containers[0].command.should.eql(["node", "server.js"]);
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.cpu.should.equal('300m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.requests.memory.should.equal('100Mi');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.cpu.should.equal('500m');
        res.body.kubercjson.spec.template.spec.containers[0].resources.limits.memory.should.equal('200Mi');
        res.body.kubercjson.spec.template.spec.containers[0].lifecycle.postStart.exec.command.should.eql(["/bin/sh", "-c", "echo 127.0.0.100 test >> /etc/hosts"]);
        res.body.endpoints.should.be.an.instanceOf(Object).and.have.properties([config.test.kubelocation]);
        res.body.endpoints[config.test.kubelocation].should.have.properties(['latest','this']);
        res.body.token.should.equal('REDACTED');
        done();
      });
    });
  });

  describe('/api/v1/deployment', () => {
    it('it should GET the list of all deployments', (done) => {
      chai.request(server)
      .get('/api/v1/deployment')
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['err', 'deployments']);
        res.body.err.should.equal(false);
        res.body.deployments.should.be.instanceof(Array);
        res.body.deployments.should.containEql(config.test.kubenamespace + '.deployments_mydeployment');
        res.body.deployments.should.containEql(config.test.kubenamespace + '.configmaps_config');
        done();
      });
    });
  });

  describe('configmap api', () => {
    it('it should delete a config map', (done) => {
      chai.request(server)
      .delete('/api/v1/object')
      .set("Content-Type", "application/json")
      .send({"correlationid": "configmap2", "type": "configmaps", "name":"config", "locations":[{"name":config.test.kubelocation}], "token": config.test.kubetoken, "namespace": config.test.kubenamespace})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['name', 'locations', 'token', 'namespace', 'deleteClusters', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.message.should.equal('done processing.');
        res.body.token.should.equal('REDACTED');
        done();
        });
    });
    it('it should return a 422', (done) => {
      chai.request(server)
      .delete('/api/v1/object')
      .set("Content-Type", "application/json")
      .send({"correlationid": "configmap3", "type": "configmaps", "name":"config", "locations":[{"name":config.test.kubelocation}], "token": "", "namespace": config.test.kubenamespace})
      .end((err, res) => {
        res.status.should.be.equal(422);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['name', 'locations', 'token', 'namespace', 'deleteClusters', 'result']);
        res.body.err.should.equal(true);
        res.body.locations.should.be.instanceof(Array);
        res.body.result.should.be.instanceof(Object).and.have.properties(['message']);
        res.body.token.should.equal('REDACTED');
        done();
        });
    });
  });

  describe('secrets api', () => {
    it('it should delete a secret', (done) => {
      chai.request(server)
      .delete('/api/v1/object')
      .set("Content-Type", "application/json")
      .send({"correlationid": "secrets2", "type": "secrets", "name":"vault", "locations":[{"name":config.test.kubelocation}], "token": config.test.kubetoken, "namespace": config.test.kubenamespace, "clusters":2})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['name', 'locations', 'token', 'namespace', 'deleteClusters', 'result']);
        res.body.err.should.equal(false);
        res.body.locations.should.be.instanceof(Array);
        res.body.token.should.equal('REDACTED');
        done();
      });
    });
  });

  describe('/api/v1/deployment', () => {
    it('it should delete a deployment', (done) => {
      chai.request(server)
      .delete('/api/v1/deployment')
      .set("Content-Type", "application/json")
      .send({"correlationid": "deployment5", "name":"mydeployment", "locations":[{"name":config.test.kubelocation}],"token": config.test.kubetoken, "namespace": config.test.kubenamespace, "removeService": true})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['locations', 'deleteClusters', 'result']);
        res.body.locations.should.be.instanceof(Array);
        res.body.token.should.equal('REDACTED');
        res.body.message.should.equal('done processing.');
        res.body.err.should.equal(false);
        res.body.result.message.should.equal('completed deployment API calls, check deleteClusters.');
        done();
      });
    });
  });

describe('/api/v1/deployment', () => {
    it('it should confirm the deployments are deleted from the master list', (done) => {
      chai.request(server)
      .get('/api/v1/deployment')
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.properties(['err', 'deployments']);
        res.body.deployments.should.be.instanceof(Array);
        res.body.deployments.should.not.containEql(config.test.kubenamespace + '.deployments.mydeployment');
        res.body.deployments.should.not.containEql(config.test.kubenamespace + '.configmaps.config');
        done();
      });
    });
  });

  describe('/api/v1/config/cluster', () => {
    it('it should DELETE a cluster config', (done) => {
      chai.request(server)
      .delete('/api/v1/config/cluster')
      .send({"context":"minikube","location":"minikube"})
      .end((err, res) => {
        res.status.should.be.equal(200);
        res.body.should.be.an.instanceOf(Object).and.have.property('locations');
        res.body.locations.should.be.instanceof(Array);
        res.body.locations.should.not.containDeep([{"registry":"mylocalregistry", "server":"http://127.0.0.1:8001", "context":"minikube", "location":"local", "defaultENV":[{"name":"DEFAULT", "value":"mydefault"}, {"name":"DEFAULT2", "value":"mydefault2"}]}]);
        done();
      });
    });
  });

});

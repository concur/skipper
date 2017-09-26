'use strict';
var SwaggerTools = require('swagger-tools');
var cors = require('cors');
var YAML = require('yamljs');
var swaggerObject = YAML.load('./api/swagger/swagger.yaml');
// add timestamps in front of log messages
require('console-stamp')(console, {pattern: "m/dd/yy HH:MM:ss.l", label: false});

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json({limit: '50mb'}));

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  err.err = true;
  console.log(err);
  res.status(500).json(err);
}

var config = {
    appRoot: __dirname, // required config
};

// Initialize the Swagger Middleware
SwaggerTools.initializeMiddleware(swaggerObject, function (middleware) {
  // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain

  app.use(middleware.swaggerMetadata());

  // Validate Swagger requests
  app.use(middleware.swaggerValidator({
    validateResponse: false
  }));

  // Route validated requests to appropriate controller
  app.use(middleware.swaggerRouter({useStubs: true, controllers: './api/controllers'}));

  // Serve the Swagger documents and Swagger UI
  app.use(middleware.swaggerUi({apiDocs: '/apidocs'}));
  
  app.use(errorHandler);
  
  // Start the server
  var port = process.env.PORT || 5000;
  
  var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('listening on %s:%s', host, port);
  });
  
});



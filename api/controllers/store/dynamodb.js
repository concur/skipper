'use strict';
  
var AWS = require('aws-sdk');
var config = require('../../../default/config');
var crypto = require('crypto');
var _ = require('lodash');
var proxy = require('proxy-agent');

const ddbtable = config.storage.dynamodb.table;
const awsregion = config.storage.dynamodb.awsregion;
const awskey = config.storage.dynamodb.awskey;
const awssecret = config.storage.dynamodb.awssecret;
const awsproxy = config.storage.dynamodb.awsproxy;

var $credentials = {
  "accessKeyId": awskey,
  "secretAccessKey": awssecret,
  region: awsregion
};
  
if (awsproxy != null && awsproxy != "") {
  $credentials.httpOptions = {agent: proxy(awsproxy)};
}

if (config.storage.dynamodb.awskey !== "") {
  var DynamoDB = require('@awspilot/dynamodb')($credentials);
  AWS.config.update($credentials);
  console.log("updated aws config.");
} else {
  var $db = new AWS.DynamoDB();
  $db.region = awsregion;
  var DynamoDB = require('@awspilot/dynamodb')($db);
  console.log("updated aws config from AWS Instance Profile.");
};

const token = '~&*^AWSSTILLHASNOTFIXEDTHIS!!!~&*^';

const tokenizeEmptyStringElements = function (obj) {
  for (var prop in obj) {
    if (typeof obj[prop] === 'object') {// dive deeper in
      tokenizeEmptyStringElements(obj[prop]);
    } else if(obj[prop] === '') {
      // tokenize elements that are empty strings
      obj[prop] = token
    }
  }
  return obj;
};

const detokenizeEmptyStringElements = function (obj) {
  for (var prop in obj) {
    if (typeof obj[prop] === 'object') {
      detokenizeEmptyStringElements(obj[prop]);
    } else if(obj[prop] === token) {
      // tokenize elements that are empty strings
      obj[prop] = ''
    }
  }
  return obj;
};

exports.delConfigItemsJSON = function (queryitem, callback) {
  var configitem = crypto.createHash('md5').update(queryitem).digest('hex');
  
  DynamoDB
    .table(ddbtable)
    .where('configitem').eq(configitem)
    .delete(function (err, data) {
      if (err) {
        return callback(err, null);
      } else {
        return callback(null, detokenizeEmptyStringElements(data));
      }
    });
};

exports.getConfigItemsJSON = function (queryitem, callback) {
  var configitem = crypto.createHash('md5').update(queryitem).digest('hex');
  
  DynamoDB
    .table(ddbtable)
    .where('configitem').eq(configitem)
    .get(function (err, data) {
      if (err) {
        console.log('ddb getConfigItemsJSON error', err);
        return callback(err, null);
      } else {
        return callback(null, detokenizeEmptyStringElements(data));
      }
    });
};

exports.putConfigItemsJSON = function (queryitem, obj, callback) {
  var object = JSON.parse(JSON.stringify(obj)), configitem = crypto.createHash('md5').update(queryitem).digest('hex');
  
  if (_.isObject(object)) {
    object.configitem = configitem;
  } else {
    console.log("putConfigItemsJSON obj is not an object type:", object);
    return callback(new Error("obj is not an object type"), object);
  }
          
  exports.delConfigItemsJSON(queryitem, function (err, data) {
    if (err) {
      return callback(err, data);
    } else {
      DynamoDB
      .table(ddbtable)
      .where('configitem').eq(configitem)
      .insert_or_replace(tokenizeEmptyStringElements(object), function (err, data) {
        if (err) {
          console.log("ddb error:", err);
          return callback(err, data);
        } else {
          return callback(null, detokenizeEmptyStringElements(data));
        }
      });
    }
  });
};
                                
exports.delConfigItems = function (configitem, configvalue, callback) {
    'use strict';

    AWS.config.region = awsregion;
    var dynamo = new AWS.DynamoDB({apiVersion: '2012-08-10'}), results = [];
    var params = {
        Key: { configitem: { S: configitem } },
        TableName: ddbtable,
        AttributeUpdates: {
            items: {
                Action: 'DELETE',
                Value: {
                    SS: [ configvalue ]
                }
            }
        },
        ReturnValues: 'UPDATED_NEW'
    };
    
    try {
        dynamo.updateItem(params, function (err, data) {
            if (err) {
              console.log("delConfigItems:", err, err.stack);
              return callback(err, null);
            } else {
              return callback(null, _.get(data, 'Attributes.items.SS', ""));
            }
        });
    } catch (err) {
        res.json({result: "Dynamo query failed."});
    }
};

exports.getConfigItems = function (queryitem, callback) {
  'use strict';
  
  AWS.config.region = awsregion;
  
  var dynamo = new AWS.DynamoDB({apiVersion: '2012-08-10'}), results = [];
  var params = {
    Key: { configitem: { S: queryitem } },
    TableName: ddbtable,
    AttributesToGet: ['items']
  };
  dynamo.getItem(params, function (err, data) {
    if (err) {
      console.log("getConfigItems:", err, err.stack);
      return callback(err, null);
    } else {
      return callback(null, _.get(data, 'Item.items.SS', []));
    }
  });
};

exports.putConfigItems = function (configitem, configvalue, callback) {
    'use strict';
    
    AWS.config.region = awsregion;
    var dynamo = new AWS.DynamoDB({apiVersion: '2012-08-10'}), results = [];
    
    var params = {
        Key: { configitem: { S: configitem } },
        TableName: ddbtable,
        AttributeUpdates: {
            items: {
                Action: 'ADD',
                Value: {
                    SS: [ configvalue ]
                }
            }
        },
        ReturnValues: 'UPDATED_NEW'
    };
    
    try {
        dynamo.updateItem(params, function (err, data) {
            if (err) {
              console.log("putConfigItems:", err, err.stack); // an error occurred
              return callback(err, null);
            } else {
              return callback(null, _.get(data, 'Attributes.items.SS', ""));
            } // successful response
        });
    } catch (err) {
        res.json({result: "Dynamo query failed."});
    }
};

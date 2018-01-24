const async = require('async');
const diffPatcher = require('jsondiffpatch').create();

const History = require('./diffHistoryModel');

const saveHistoryObject = function(history, callback) {
  history.save(function(err) {
    if (err) {
      err.message = 'Mongo Error :' + err.message;
    }
    callback();
  });
};

const saveDiffObject = function(currentObject, original, updated, user, reason, callback) {
  const diff = diffPatcher.diff(
    JSON.parse(JSON.stringify(original)),
    JSON.parse(JSON.stringify(updated))
  );
  if (diff) {
    History.findOne({
      collectionName: currentObject.constructor.modelName,
      collectionId: currentObject._id
    })
      .sort('-version')
      .exec(function(err, lastHistory) {
        if (err) {
          err.message = 'Mongo Error :' + err.message;
          return callback();
        }
        const history = new History({
          collectionName: currentObject.constructor.modelName,
          collectionId: currentObject._id,
          diff: diff,
          user: user,
          reason: reason,
          version: lastHistory ? lastHistory.version + 1 : 0
        });
        saveHistoryObject(history, callback);
      });
  } else {
    callback();
  }
};

const saveDiffHistory = function(queryObject, currentObject, callback) {
  currentObject.constructor.findOne({ _id: currentObject._id }, function(err, selfObject) {
    if (selfObject) {
      const dbObject = {};
      const updateParams = queryObject._update['$set']
        ? queryObject._update['$set']
        : queryObject._update;
      Object.keys(updateParams).forEach(function(key) {
        dbObject[key] = selfObject[key];
      });
      saveDiffObject(
        currentObject,
        dbObject,
        updateParams,
        queryObject.options.__user,
        queryObject.options.__reason,
        function() {
          callback();
        }
      );
    }
  });
};

const saveDiffs = function(self, next) {
  const queryObject = self;
  queryObject.find(queryObject._conditions, function(err, results) {
    if (err) {
      err.message = 'Mongo Error :' + err.message;
      return next();
    }
    async.eachSeries(
      results,
      function(result, callback) {
        if (err) {
          err.message = 'Mongo Error :' + err.message;
          return next();
        }
        saveDiffHistory(queryObject, result, callback);
      },
      function done() {
        return next();
      }
    );
  });
};

const getVersion = function(model, id, version, callback) {
  model.findOne({ _id: id }, function(err, latest) {
    if (err) {
      console.error(err);
      return callback(err, null);
    }
    History.find(
      {
        collectionName: model.modelName,
        collectionId: id,
        version: { $gte: parseInt(version, 10) }
      },
      { diff: 1, version: 1 },
      { sort: '-version' },
      function(err, histories) {
        if (err) {
          console.error(err);
          return callback(err, null);
        }
        const object = latest ? latest : {};
        async.each(
          histories,
          function(history, eachCallback) {
            diffPatcher.unpatch(object, history.diff);
            eachCallback();
          },
          function(err) {
            if (err) {
              console.error(err);
              return callback(err, null);
            }
            callback(null, object);
          }
        );
      }
    );
  });
};

const getHistories = function(modelName, id, expandableFields, callback) {
  History.find({ collectionName: modelName, collectionId: id }, function(err, histories) {
    if (err) {
      console.error(err);
      return callback(err, null);
    }
    async.map(
      histories,
      function(history, mapCallback) {
        const changedValues = [];
        const changedFields = [];
        for (const key in history.diff) {
          if (history.diff.hasOwnProperty(key)) {
            if (expandableFields.indexOf(key) > -1) {
              //var oldDate = new Date(history.diff[key][0]);
              //var newDate = new Date(history.diff[key][1]);
              //if (oldDate != "Invalid Date" && newDate != "Invalid Date") {
              //    oldValue = oldDate.getFullYear() + "-" + (oldDate.getMonth() + 1) + "-" + oldDate.getDate();
              //    newValue = newDate.getFullYear() + "-" + (newDate.getMonth() + 1) + "-" + newDate.getDate();
              //}
              //else {
              const oldValue = history.diff[key][0];
              const newValue = history.diff[key][1];
              //}
              changedValues.push(key + ' from ' + oldValue + ' to ' + newValue);
            } else {
              changedFields.push(key);
            }
          }
        }
        const comment = 'modified ' + changedFields.concat(changedValues).join(', ');
        return mapCallback(null, {
          changedBy: history.user,
          changedAt: history.createdAt,
          updatedAt: history.updatedAt,
          reason: history.reason,
          comment: comment
        });
      },
      function(err, output) {
        if (err) {
          console.error(err);
          return callback(err, null);
        }
        return callback(null, output);
      }
    );
  });
};

const plugin = function lastModifiedPlugin(schema) {
  schema.pre('save', function(next) {
    const self = this;
    if (self.isNew) {
      next();
    } else {
      self.constructor.findOne({ _id: self._id }, function(err, original) {
        saveDiffObject(self, original, self, self.__user, self.__reason, function() {
          next();
        });
      });
    }
  });

  schema.pre('findOneAndUpdate', function(next) {
    saveDiffs(this, function() {
      next();
    });
  });

  schema.pre('update', function(next) {
    saveDiffs(this, function() {
      next();
    });
  });

  schema.pre('remove', function(next) {
    saveDiffObject(this, this, {}, this.__user, this.__reason, function() {
      next();
    });
  });
};

module.exports.plugin = plugin;
module.exports.getHistories = getHistories;
module.exports.getVersion = getVersion;

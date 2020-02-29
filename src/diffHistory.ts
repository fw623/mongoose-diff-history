import omit from 'omit-deep'
import pick from 'lodash.pick'
import mongoose, { Schema, Query } from 'mongoose'
import { assign } from "power-assign"
import empty from "deep-empty-object"
import jsondiffpatch from 'jsondiffpatch'
import { historyModel } from './historyModel'
import { GetHistories, HistoryInterface, PluginOptions } from './types'

// try to find an id property, otherwise just use the index in the array
const objectHash = (obj: any, idx: any): string => obj._id ?? obj.id ?? `$$index: ${idx}`
const diffPatcher = jsondiffpatch.create({ objectHash })

const isValidCb = (cb: unknown): boolean => {
  return cb && typeof cb === 'function'
}

function checkRequired(opts, queryObject, updatedObject?) {
  if ((queryObject && !queryObject.options) && !updatedObject) {
    return
  }
  const { __user: user, __reason: reason } = queryObject && queryObject.options || updatedObject
  if (opts.required && (opts.required.includes("user") && !user ||
    opts.required.includes("reason") && !reason)
  ) {
    return true
  }
}

async function saveDiffObject(currentObject, original, updated, opts, queryObject?) {
  // @TODO: verify that queryObject.getOptions() works
  // const { __user: user, __reason: reason, __session: session } = queryObject && queryObject.options || currentObject
  const { __user: user, __reason: reason, __session: session } = queryObject ? queryObject.getOptions() : currentObject

  let diff = diffPatcher.diff(
    JSON.parse(JSON.stringify(original)),
    JSON.parse(JSON.stringify(updated))
  )

  if (opts.omit) {
    omit(diff, opts.omit, { cleanEmpty: true })
  }

  if (opts.pick) {
    diff = pick(diff, opts.pick)
  }

  if (!diff || !Object.keys(diff).length || empty.all(diff)) {
    return
  }

  const collectionId = currentObject._id
  const collectionName = currentObject.constructor.modelName ?? queryObject.model.modelName

  return historyModel.findOne({ collectionId, collectionName })
    .sort('-version')
    .then(lastHistory => {
      const history = new historyModel({
        collectionId,
        collectionName,
        diff,
        user,
        reason,
        version: lastHistory ? lastHistory.version + 1 : 0
      })
      if (session) {
        return history.save({ session })
      }
      return history.save()
    })
}

const saveDiffHistory = (queryObject, currentObject, opts) => {
  const update = JSON.parse(JSON.stringify(queryObject._update))
  const updateParams = Object.keys(update).map((key) => typeof update[key] === "object" ? update[key] : update)

  delete queryObject._update["$setOnInsert"]
  const dbObject = pick(currentObject, Object.keys(updateParams))
  return saveDiffObject(
    currentObject,
    dbObject,
    assign(dbObject, queryObject._update),
    opts,
    queryObject
  )
}

const saveDiffs = (queryObject, opts) =>
  queryObject
    .find(queryObject._conditions)
    .lean(false)
    .cursor()
    .eachAsync(result => saveDiffHistory(queryObject, result, opts))

const getVersion = (model, id, version, queryOpts, cb) => {
  if (typeof queryOpts === 'function') {
    cb = queryOpts
    queryOpts = undefined
  }

  return model
    .findById(id, null, queryOpts)
    .then(latest => {
      latest = latest || {}
      return historyModel.find(
        {
          collectionName: model.modelName,
          collectionId: id,
          version: { $gte: parseInt(version, 10) }
        },
        { diff: 1, version: 1 },
        { sort: '-version' }
      )
        .lean()
        .cursor()
        .eachAsync(history => {
          diffPatcher.unpatch(latest, history.diff)
        })
        .then(() => {
          if (isValidCb(cb)) return cb(null, latest)
          return latest
        })
    })
    .catch(err => {
      if (isValidCb(cb)) return cb(err, null)
      throw err
    })
}

const getDiffs = (modelName, id, opts, cb) => {
  opts = opts || {}
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  return historyModel.find({ collectionName: modelName, collectionId: id }, null, opts)
    .lean()
    .then(histories => {
      if (isValidCb(cb)) return cb(null, histories)
      return histories
    })
    .catch(err => {
      if (isValidCb(cb)) return cb(err, null)
      throw err
    })
}

const getHistories = (modelName, id, expandableFields, cb) => {
  expandableFields = expandableFields || []
  if (typeof expandableFields === 'function') {
    cb = expandableFields
    expandableFields = []
  }

  const histories: GetHistories[] = []

  return historyModel.find({ collectionName: modelName, collectionId: id })
    .lean()
    .cursor()
    .eachAsync((history: HistoryInterface) => {
      const changedValues: string[] = []
      const changedFields: string[] = []
      for (const key in history.diff) {
        if (history.diff.hasOwnProperty(key)) {
          if (expandableFields.indexOf(key) > -1) {
            const oldValue = history.diff[key][0]
            const newValue = history.diff[key][1]
            changedValues.push(key + ' from ' + oldValue + ' to ' + newValue)
          } else {
            changedFields.push(key)
          }
        }
      }
      const comment = 'modified ' + changedFields.concat(changedValues).join(', ')
      histories.push({
        changedBy: history.user,
        changedAt: history.createdAt,
        updatedAt: history.updatedAt,
        reason: history.reason,
        comment: comment
      })
    })
    .then(() => {
      if (isValidCb(cb)) return cb(null, histories)
      return histories
    })
    .catch(err => {
      if (isValidCb(cb)) return cb(err, null)
      throw err
    })
}

/**
 * @param {Object} schema - Schema object passed by Mongoose Schema.plugin
 * @param {Object} [opts] - Options passed by Mongoose Schema.plugin
 * @param {string} [opts.uri] - URI for MongoDB (necessary, for instance, when not using mongoose.connect).
 * @param {string|string[]} [opts.omit] - fields to omit from diffs (ex. ['a', 'b.c.d']).
 */
const plugin = function lastModifiedPlugin(schema: Schema<unknown>, options: PluginOptions = {}) {
  if (options?.uri) {
    const mongoVersion = parseInt(mongoose.version)
    if (mongoVersion < 5) {
      mongoose.connect(options.uri, { useMongoClient: true, ...options.connectionOptions }).catch((e) => {
        console.error('mongoose-diff-history connection error:', e)
      })
    } else {
      mongoose.connect(options.uri, { useNewUrlParser: true, ...options.connectionOptions }).catch((e) => {
        console.error('mongoose-diff-history connection error:', e)
      })
    }
  }

  if (options.omit && !Array.isArray(options.omit)) {
    if (typeof options.omit === 'string') {
      options.omit = [options.omit]
    } else {
      const errMsg = `opts.omit expects string or array, instead got '${typeof options.omit}'`
      throw new TypeError(errMsg)
    }
  }

  schema.pre('save', function (next) {
    if (this.isNew) {
      return next()
    }

    (this.constructor as any)
      .findOne({ _id: this._id })
      .then((original) => {
        if (checkRequired(options, {}, this)) { return }
        return saveDiffObject(this, original, this.toObject({ depopulate: true }), options)
      })
      .then(() => next())
      .catch(next)
  })

  schema.pre('findOneAndUpdate', function (next) {
    if (checkRequired(options, this)) { return next() }
    saveDiffs(this, options)
      .then(() => next())
      .catch(next)
  })

  schema.pre('update', function (next) {
    if (checkRequired(options, this)) { return next() }
    saveDiffs(this, options)
      .then(() => next())
      .catch(next)
  })

  schema.pre('updateOne', function (next) {
    if (checkRequired(options, this)) { return next() }
    saveDiffs(this, options)
      .then(() => next())
      .catch(next)
  })

  schema.pre('remove', function (next) {
    if (checkRequired(options, this)) { return next() }

    saveDiffObject(this, this, {}, options)
      .then(() => next())
      .catch(next)
  })
}

module.exports = {
  plugin,
  getVersion,
  getDiffs,
  getHistories
}

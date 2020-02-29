import mongoose, { Schema } from 'mongoose'
import { DocumentWithHistory, PluginOptions } from './types'
import { getHistories, getDiffs, getVersion } from './getHistory'
import { checkRequired, saveDiffObject, saveDiffs } from './util'

/**
 * @param {Object} schema - Schema object passed by Mongoose Schema.plugin
 * @param {Object} [opts] - Options passed by Mongoose Schema.plugin
 * @param {string} [opts.uri] - URI for MongoDB (necessary, for instance, when not using mongoose.connect).
 * @param {string|string[]} [opts.omit] - fields to omit from diffs (ex. ['a', 'b.c.d']).
 */
export const initPlugin = function lastModifiedPlugin(schema: Schema<any>, { modelName, ...options }: PluginOptions) {
  if (options?.uri) {
    const mongoVersion = parseInt(mongoose.version)
    if (mongoVersion < 5) {
      mongoose.connect(options.uri, { useMongoClient: true, useUnifiedTopology: true, useFindAndModify: true, ...options.connectionOptions }).catch((e) => {
        console.error('mongoose-diff-history connection error:', e)
      })
    } else {
      mongoose.connect(options.uri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: true, ...options.connectionOptions }).catch((e) => {
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

  // add static methods to model/schema
  schema.statics.getHistories = (id) => getHistories(modelName, id)
  schema.statics.getDiffs = (id) => getDiffs(modelName, id)
  schema.statics.getVersion = (id, version) => getVersion(mongoose.model(modelName), id, version)

  // add methods to documents
  schema.methods.getHistories = function () { return getHistories(modelName, this._id) }
  schema.methods.getDiffs = function () { return getDiffs(modelName, this._id) }
  schema.methods.getVersion = function (version) { return getVersion(mongoose.model(modelName), this._id, version) }

  // add middlewares
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

  // schema.pre('save', async function (): Promise<void> {
  //   console.log('CL: schema.methods.getVersion -> this', this)
  //   if (this.isNew) return

  //   const original = await (this.constructor as any).findOne({ _id: this._id })

  //   if (checkRequired(options, undefined, this as DocumentWithHistory<unknown>)) return
  //   await saveDiffObject(this, original, this.toObject({ depopulate: true }), options)
  // })

  schema.pre('findOneAndUpdate', function (next) {
    if (checkRequired(options, this)) { return next() }
    console.log('CL: schema.methods.getVersion -> this', this)
    console.log('CL: schema.methods.getVersion -> options', options)

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
    if (checkRequired(options, undefined, this as DocumentWithHistory<unknown>)) { return next() }

    saveDiffObject(this, this, {}, options)
      .then(() => next())
      .catch(next)
  })
}

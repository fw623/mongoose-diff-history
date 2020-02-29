import mongoose, { Schema } from 'mongoose'
import { DocumentWithHistory, PluginOptions } from './types'
import { getHistory, getHistoryDiffs, getVersion } from './getHistory'
import { checkRequired, saveDiffObject, saveDiffs } from './util'

/**
 * @param {Object} schema - Schema object passed by Mongoose Schema.plugin
 * @param {Object} [opts] - Options passed by Mongoose Schema.plugin
 * @param {string} [opts.uri] - URI for MongoDB (necessary, for instance, when not using mongoose.connect).
 * @param {string|string[]} [opts.omit] - fields to omit from diffs (ex. ['a', 'b.c.d']).
 */

export async function initPlugin (schema: Schema<any>, { modelName, ...options }: PluginOptions): Promise<void> {
  // handle options
  if (options?.uri) {
    const mongoVersion = parseInt(mongoose.version, 10)
    if (mongoVersion < 5) {
      mongoose.connect(options.uri, {
        useMongoClient: true,
        useUnifiedTopology: true,
        useFindAndModify: true,
        ...options.connectionOptions
      })
    } else {
      mongoose.connect(options.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: true,
        ...options.connectionOptions
      })
    }
  }

  // add static methods to model/schema
  schema.statics.getHistory = (id) => getHistory(modelName, id)
  schema.statics.getHistoryDiffs = (id) => getHistoryDiffs(modelName, id)
  schema.statics.getVersion = (id, version) => getVersion(mongoose.model(modelName), id, version)

  // add methods to documents
  schema.methods.getHistory = function () { return getHistory(modelName, this._id) }
  schema.methods.getHistoryDiffs = function () { return getHistoryDiffs(modelName, this._id) }
  schema.methods.getVersion = function (version) { return getVersion(mongoose.model(modelName), this._id, version) }

  // add middlewares
  schema.pre('save', async function (): Promise<void> {
    const original = await this.model(modelName).findOne({ _id: this._id }) ?? {}

    if (checkRequired(options, undefined, this as DocumentWithHistory<unknown>)) return
    await saveDiffObject(this, original, this.toObject({ depopulate: true }), options)
  })

  schema.pre('findOneAndUpdate', async function (): Promise<void> {
    if (checkRequired(options, this)) return
    await saveDiffs(this, options)
  })

  schema.pre('update', async function (): Promise<void> {
    if (checkRequired(options, this)) return
    await saveDiffs(this, options)
  })

  schema.pre('updateOne', async function (): Promise<void> {
    if (checkRequired(options, this)) return
    await saveDiffs(this, options)
  })

  schema.pre('remove', async function () {
    if (checkRequired(options, undefined, this as DocumentWithHistory<unknown>)) return
    await saveDiffObject(this, this, {}, options)
  })
}

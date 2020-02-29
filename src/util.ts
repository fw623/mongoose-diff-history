import empty from 'deep-empty-object'
import jsondiffpatch from 'jsondiffpatch'
import pick from 'lodash.pick'
import { Query } from 'mongoose'
import omit from 'omit-deep'
import { assign } from 'power-assign'
import { historyModel } from './historyModel'
import { DocumentWithHistory, PluginOptions } from './types'

// try to find an id property, otherwise just use the index in the array
const objectHash = (obj: any, idx: any): string => obj._id ?? obj.id ?? `$$index: ${idx}`
export const diffPatcher = jsondiffpatch.create({ objectHash })

export const isValidCb = (cb: unknown): boolean => {
  return cb && typeof cb === 'function'
}

export function validateRequired(options: Omit<PluginOptions, 'modelName'>, queryObject: Query<unknown> | undefined, updatedObject?: DocumentWithHistory<unknown>): void {
  const { __user: user, __reason: reason } = queryObject ? queryObject.getOptions() : updatedObject
  if ((options.required ?? []).includes('user') && !user) {
    throw new Error(`user is required when making change to document but not defined`)
  }
  if ((options.required ?? []).includes('reason') && !reason) {
    throw new Error(`reason is required when making change to document but not defined`)
  }
}

export async function saveDiffObject(currentObject, original, updated, opts, queryObject?) {
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

export const saveDiffHistory = (queryObject, currentObject, opts) => {
  const update = JSON.parse(JSON.stringify(queryObject._update))
  const updateParams = Object.keys(update).map((key) => typeof update[key] === 'object' ? update[key] : update)

  delete queryObject._update['$setOnInsert']
  const dbObject = pick(currentObject, Object.keys(updateParams))
  return saveDiffObject(
    currentObject,
    dbObject,
    assign(dbObject, queryObject._update),
    opts,
    queryObject
  )
}

export const saveDiffs = (queryObject, opts) =>
  queryObject
    .find(queryObject._conditions)
    .lean(false)
    .cursor()
    .eachAsync(result => saveDiffHistory(queryObject, result, opts))

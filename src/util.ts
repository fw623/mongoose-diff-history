import empty from 'deep-empty-object'
import jsondiffpatch from 'jsondiffpatch'
import pick from 'lodash.pick'
import { Document, Model, Query } from 'mongoose'
import omit from 'omit-deep'
import { assign } from 'power-assign'
import { historyModel } from './historyModel'
import { PluginOptions } from './types'

// try to find an id property, otherwise just use the index in the array
const objectHash = (obj: any, idx: any): string => obj._id ?? obj.id ?? `$$index: ${idx}`
export const diffPatcher = jsondiffpatch.create({ objectHash })

export function validateRequired(options: Omit<PluginOptions, 'modelName'>, queryObject: Query<unknown> | undefined, updatedObject?: Document): void {
  const { __user: user, __reason: reason } = queryObject ? queryObject.getOptions() : updatedObject
  if ((options.required ?? []).includes('user') && !user) {
    throw new Error(`user is required when making change to document but not defined`)
  }
  if ((options.required ?? []).includes('reason') && !reason) {
    throw new Error(`reason is required when making change to document but not defined`)
  }
}

export async function saveDiffObject(currentObject: Document, original: Partial<Document>, updated: Partial<Document>, pluginOptions: Omit<PluginOptions, 'modelName'>, query?: Query<unknown>) {
  const { __user: user, __reason: reason, __session: session } = query ? query.getOptions() : currentObject

  let diff = diffPatcher.diff(
    JSON.parse(JSON.stringify(original)),
    JSON.parse(JSON.stringify(updated))
  )

  if (pluginOptions.omit) {
    omit(diff, pluginOptions.omit, { cleanEmpty: true })
  }

  if (pluginOptions.pick) {
    diff = pick(diff, pluginOptions.pick)
  }

  if (!diff || !Object.keys(diff).length || empty.all(diff)) {
    return
  }

  const collectionId = currentObject._id
  const collectionName = (currentObject.constructor as Model<any>).modelName ?? (query as any).model?.modelName

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

export const saveDiffHistory = (query: Query<unknown>, currentObject: Document, pluginOptions: Omit<PluginOptions, 'modelName'>) => {
  const update = JSON.parse(JSON.stringify(query.getUpdate()))
  const updateParams = Object.keys(update).map((key) => typeof update[key] === 'object' ? update[key] : update)

  delete query.getUpdate()['$setOnInsert']
  const dbObject = pick(currentObject, Object.keys(updateParams))
  return saveDiffObject(
    currentObject,
    dbObject,
    assign(dbObject, query.getUpdate()),
    pluginOptions,
    query
  )
}

  export const saveDiffs = (query: Query<unknown>, pluginOptions: Omit<PluginOptions, 'modelName'>) => {
  return query
    .find((query as any)._conditions)
    .lean(false)
    .cursor()
    .eachAsync((result: Document) => saveDiffHistory(query, result, pluginOptions))
}

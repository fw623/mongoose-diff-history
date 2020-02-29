import { Model, Schema } from "mongoose"
import { historyModel } from "./historyModel"
import { GetHistories, HistoryInterface } from "./types"
import { isValidCb, diffPatcher } from "./util"

export const getVersion = (model: Model<any>, id: Schema.Types.ObjectId, version: string, queryOpts?, cb?) => {
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

export const getDiffs = (modelName: string, id: Schema.Types.ObjectId, opts?, cb?) => {
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

export const getHistories = (modelName: string, id: Schema.Types.ObjectId, expandableFields: any[] = [], cb?) => {
  // handle if last param is supposed to be callback
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

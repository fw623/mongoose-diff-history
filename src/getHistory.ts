import { Document, Model, Schema } from "mongoose"
import { historyModel } from "./historyModel"
import { GetHistories, HistoryDiff, HistoryInterface } from "./types"
import { diffPatcher, isValidCb } from "./util"

export const getVersion = async<T extends Document>(model: Model<T>, id: Schema.Types.ObjectId, version: number, queryOpts?): Promise<T> => {
  const latest = await model.findById(id, null, queryOpts) ?? new model()

  await historyModel.find(
    {
      collectionName: model.modelName,
      collectionId: id,
      version: { $gte: version }
    },
    { diff: 1, version: 1 },
    { sort: '-version' }
  )
    .lean()
    .cursor()
    .eachAsync(({ diff }: HistoryDiff<T>) => {
      diffPatcher.unpatch(latest, diff)
    })

  return latest
}

export const getHistoryDiffs = (modelName: string, id: Schema.Types.ObjectId, opts?, cb?) => {
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

export const getHistory = (modelName: string, id: Schema.Types.ObjectId, expandableFields: any[] = [], cb?) => {
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

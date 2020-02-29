import { Document, Model, Schema } from "mongoose"
import { historyModel } from "./historyModel"
import { GetHistory, HistoryDiff } from "./types"
import { diffPatcher } from "./util"

export const getVersion = async <T extends Document>(model: Model<T>, id: Schema.Types.ObjectId, version: number, queryOpts?): Promise<T> => {
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

export const getHistoryDiffs = async <T extends Document>(model: Model<T>, id: Schema.Types.ObjectId, opts?: any): Promise<HistoryDiff<T>[]> => {
  return historyModel.find({ collectionName: model.modelName, collectionId: id }, null, opts).lean()
}

export const getHistory = async <T extends Document>(model: Model<T>, id: Schema.Types.ObjectId, expandableFields: any[] = []): Promise<GetHistory[]> => {
  const histories: GetHistory[] = []

  await historyModel.find({ collectionName: model.modelName, collectionId: id })
    .lean()
    .cursor()
    .eachAsync((history: HistoryDiff<T>) => {
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

  return histories
}

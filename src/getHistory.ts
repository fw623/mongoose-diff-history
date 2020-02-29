import { Document, Model, Schema } from "mongoose"
import { historyModel } from "./historyModel"
import { GetHistory, HistoryDiff } from "./types"
import { diffPatcher } from "./util"

export const getVersion = async <T extends Document>(model: Model<T>, id: Schema.Types.ObjectId, version: number): Promise<T> => {
  const latest = await model.findById(id) ?? new model()

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

export const getHistoryDiffs = async <T extends Document>(model: Model<T>, id: Schema.Types.ObjectId): Promise<HistoryDiff<T>[]> => {
  return historyModel.find({ collectionName: model.modelName, collectionId: id }).lean()
}

export const getHistory = async <T extends Document>(model: Model<T>, id: Schema.Types.ObjectId, expandableFields: string[] = []): Promise<GetHistory[]> => {
  const history: GetHistory[] = []

  await historyModel.find({ collectionName: model.modelName, collectionId: id })
    .lean()
    .cursor()
    .eachAsync((historyDiff: HistoryDiff<T>) => {
      const changedValues: string[] = []
      const changedFields: string[] = []

      for (const key in historyDiff.diff) {
        if (!expandableFields.includes(key) || !Array.isArray(historyDiff.diff[key])) {
          changedFields.push(key)
          continue
        }

        const oldValue = historyDiff.diff[key].length <= 1 ? undefined : historyDiff.diff[key][0]
        const newValue = historyDiff.diff[key].length <= 1 ? historyDiff.diff[key][0] : historyDiff.diff[key][1]
        changedValues.push(`${key} from "${oldValue}" to "${newValue}"`)
      }

      const comment = 'modified ' + changedFields.concat(changedValues).join(', ')
      history.push({
        changedBy: historyDiff.user,
        changedAt: historyDiff.createdAt,
        updatedAt: historyDiff.updatedAt,
        reason: historyDiff.reason,
        comment: comment
      })
    })

  return history
}

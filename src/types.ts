import { Document, Schema, ConnectionOptions, Model } from 'mongoose'

export interface GetHistories {
  changedBy: any
  changedAt: Date
  updatedAt: Date
  reason: string
  comment: string
}

type Diff<T extends Document> = Partial<{
  [K in keyof Omit<T, keyof Document>]:
  T[K] extends (infer U)[] ? DiffArray<U>
  : undefined extends T[K] ? OptionalDiffProp<T[K]> : RequiredDiffProp<T[K]>
}>
// changed Arrays result in objects which have string keys of 1-tuples for new elements, 3-tuples for moved elements
type DiffArray<T extends unknown> = { _t: 'a' } & { [key: string]: [Exclude<T, undefined>] | [Exclude<T, undefined>, number, number] }
// when property is optional => could be new (= 1-tuple) OR updated (= 2-tuple)
type OptionalDiffProp<T extends unknown, ReqT extends Exclude<T, undefined> = Exclude<T, undefined>> = (T extends Document ? Diff<T> : [ReqT, ReqT]) | (ReqT extends Document ? Diff<ReqT> : [ReqT])
// when property is updated => 2-tuple
type RequiredDiffProp<T extends unknown> = T extends Document ? Diff<T> : [T, T]

export type GetDiffs<T extends Document> = {
  _id: string
  collectionId: string
  collectionName: string
  diff: Diff<T>
  version: number
  createdAt: Date
  updatedAt: Date
  __v: number
}

export interface HistoryInterface extends Document {
  collectionName: string
  collectionId: Schema.Types.ObjectId
  diff: any
  user: any
  reason: string,
  version: number

  // magically appear (?)
  createdAt: Date
  updatedAt: Date
}

export interface PluginOptions {
  uri?: string
  omit?: string | string[]
  pick?: string[]
  required?: string[]
  // new
  connectionOptions?: ConnectionOptions
}

// export interface SchemaWithHistory<T extends Document> extends Schema<T> {
//   __user?: any
//   __reason?: any
// }

export interface ModelWithHistory<T extends Document> extends Model<T> {
  __user?: any
  __reason?: any
  getHistories: (...args: any[]) => Promise<GetHistories[]>
  getDiffs: (...args: any[]) => Promise<GetDiffs<T>[]>
}

import { Document, Schema, ConnectionOptions, Model } from 'mongoose'

export interface GetHistory {
  changedBy: any
  changedAt: Date
  updatedAt: Date
  reason: string
  comment: string
}

// export type Diff<T extends Document> = Partial<{ [K in keyof Omit<T, keyof Document>]: any }>
export type Diff<T extends Document> = Partial<{
  [K in keyof Omit<T, keyof Document | '__user' | '__reason' | 'getHistory' | 'getHistoryDiffs' | 'getVersion'>]:
  T[K] extends (infer U)[] ? DiffArray<U>
  : undefined extends T[K] ? OptionalDiffProp<T[K]> : RequiredDiffProp<T[K]>
}>
// // changed Arrays result in objects which have string keys of 1-tuples for new elements, 3-tuples for moved elements
// type DiffArray<T extends unknown> = { _t: 'a' } & { [key: string]: [Exclude<T, undefined>] | [Exclude<T, undefined>, number, number] }
// // when property is optional => could be new (= 1-tuple) OR updated (= 2-tuple)
// type OptionalDiffProp<T extends unknown, ReqT extends Exclude<T, undefined> = Exclude<T, undefined>> = ([ReqT, ReqT]) | ([ReqT])
// // when property is updated => 2-tuple
// type RequiredDiffProp<T extends unknown> = [T, T]

// changed Arrays result in objects which have string keys of 1-tuples for new elements, 3-tuples for moved elements
type DiffArray<T extends unknown> = { _t: 'a' } & { [key: string]: [Exclude<T, undefined>] | [Exclude<T, undefined>, number, number] }
// when property is optional => could be new (= 1-tuple) OR updated (= 2-tuple)
type OptionalDiffProp<T extends unknown, ReqT extends Exclude<T, undefined> = Exclude<T, undefined>> = (T extends Document ? Diff<T> : [ReqT, ReqT]) | (ReqT extends Document ? Diff<ReqT> : [ReqT])
// when property is updated => 2-tuple
type RequiredDiffProp<T extends unknown> = T extends Document ? Diff<T> : [T, T]

export type HistoryDiff<T extends Document> = Document & {
  collectionId: Schema.Types.ObjectId
  collectionName: string
  diff: Diff<T>
  user: any
  reason: string
  version: number

  // v magically appear (?)
  createdAt: Date
  updatedAt: Date
}

export interface PluginOptions {
  uri?: string
  omit?: string[]
  pick?: string[]
  required?: { user?: boolean, reason?: boolean }
  // new
  connectionOptions?: ConnectionOptions
  modelName: string
}

export interface ModelWithHistory<T extends Document> extends Model<T> {
  getHistory: (id: Schema.Types.ObjectId, expandableFields?: string[]) => Promise<GetHistory[]>
  getHistoryDiffs: (id: Schema.Types.ObjectId) => Promise<HistoryDiff<T>[]>
  getVersion: (id: Schema.Types.ObjectId, version: number) => Promise<T>
}

export type DocumentWithHistory<Interface = unknown> = Interface & Document & {
  __user?: any
  __reason?: string
  getHistory: (expandableFields?: string[]) => Promise<GetHistory[]>
  getHistoryDiffs: () => Promise<HistoryDiff<Interface & Document>[]>
  getVersion: (version: number) => Promise<Interface>
}

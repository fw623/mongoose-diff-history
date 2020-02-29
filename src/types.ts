import { Document, Schema, ConnectionOptions } from 'mongoose'

export interface GetHistories {
  changedBy: HistoryInterface['user']
  changedAt: HistoryInterface['createdAt']
  updatedAt: HistoryInterface['updatedAt']
  reason: HistoryInterface['reason']
  comment: string
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
  connectionOptions?: ConnectionOptions
}

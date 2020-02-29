import mongoose, { Schema, Model, Document } from 'mongoose'
import { HistoryDiff } from './types';

const historySchema = new Schema<HistoryDiff<Document>>(
  {
    collectionName: String,
    collectionId: Schema.Types.ObjectId,
    diff: {},
    user: {},
    reason: String,
    version: { type: Number, min: 0 }
  },
  {
    timestamps: true
  }
);

export const historyModel: Model<HistoryDiff<Document>> = mongoose.model('_mongoose-diff-history', historySchema)

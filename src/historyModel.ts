import mongoose, { Schema, Model } from 'mongoose'
import { HistoryInterface } from './types';

const historySchema = new Schema<HistoryInterface>(
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

export const historyModel: Model<HistoryInterface> = mongoose.model('_mongoose-diff-history', historySchema)

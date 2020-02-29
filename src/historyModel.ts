import mongoose, { Schema } from 'mongoose'

const historySchema = new Schema(
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

export const historyModel = mongoose.model('History', historySchema)

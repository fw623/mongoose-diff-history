import mongoose, { Schema, Document } from "mongoose";
import { plugin } from '../src/diffHistory'

const bSchema = new Schema<bSchemaInterface>({
  c: { type: String, required: true }
})

export const testsSchema = new Schema<testsSchemaInterface>({
  a: { type: String, required: true },
  b: { type: bSchema, required: false },
  arr: [String],
  docArray: [bSchema],
})


testsSchema.plugin(plugin, { uri: 'mongodb://localhost:27017/db' })

export interface testsSchemaInterface extends Document {
  a: string
  b?: bSchemaInterface
  arr: string[]
  docArray: bSchemaInterface[]
}

interface bSchemaInterface extends Document {
  c: string
}

import mongoose, { Schema, Document } from "mongoose";
import { plugin } from '../src/diffHistory'
import { DocumentWithHistory } from "../src/types";

const bSchema = new Schema<bSchemaInterface>({
  c: { type: String, required: true }
})

export const testsSchema = new Schema<testsSchemaInterface>({
  a: { type: String, required: true },
  b: { type: bSchema, required: false },
  arr: [String],
  docArray: [bSchema],
})


testsSchema.plugin(plugin, { modelName: 'Tests', uri: 'mongodb://localhost:27017/db' })

export type testsSchemaInterface = DocumentWithHistory<{
  a: string
  b?: bSchemaInterface
  arr: string[]
  docArray: bSchemaInterface[]
}>

interface bSchemaInterface extends Document {
  c: string
}


// SCHEMA 2 to see how it behaves
export const schema2 = new Schema({
  a: String
})
schema2.plugin(plugin, { modelName: 'Schema2', uri: 'mongodb://localhost:27017/db' })

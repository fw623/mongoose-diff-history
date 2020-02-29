import { Document, Schema } from "mongoose";
import { initPlugin } from "../src";
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


testsSchema.plugin(initPlugin, { modelName: 'Tests', uri: 'mongodb://localhost:27017/db', required: ['user'] })

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
schema2.plugin(initPlugin, { modelName: 'Schema2', uri: 'mongodb://localhost:27017/db' })

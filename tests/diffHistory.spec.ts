import mongoose, { Document } from 'mongoose'
import { testsSchema, testsSchemaInterface } from './testsSchema'
import { getHistories, getDiffs } from '../src/diffHistory'
import { ModelWithHistory } from '../src/types'

describe('diffHistory', () => {
  // let testsModel: mongoose.Model<{ a: string } & Document>
  let testsModel: ModelWithHistory<testsSchemaInterface>

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/db')
    testsModel = mongoose.model('Tests', testsSchema) as any

    await testsModel.syncIndexes()
  })

  beforeEach(async () => {
    await testsModel.remove({})
  })

  afterAll(async () => {
    await testsModel.remove({})
    await mongoose.disconnect()
  })

  it('should do something', async () => {
    // console.log(mongoose.models)
  })

  it('should do something', async () => {
    const tests = new testsModel({ a: 'hi', b: { c: 'c' } })
    await tests.save()

    tests.a = 'ho'
    await tests.save()

    // const res = await getHistories('Tests', tests._id)
    const res = await getDiffs('Tests', tests._id)
    console.log('CL: res', res[0].diff)
    expect(res).toHaveLength(1)
  })

  it('should do something', async () => {
    const tests = new testsModel({ a: 'hi', b: { c: 'c' } })
    // const tests = new testsModel({ a: 'hi' })
    await tests.save()

    tests.a = 'ho'
    tests.arr = ['one', 'two', 'three']
    tests.docArray = [{ c: 'one' }, { c: 'two' }, { c: 'three' }] as any
    await tests.save()
    console.log('CL: tests', tests)

    tests.b = { c: 'd' } as any
    tests.arr = [tests.arr[2], tests.arr[1], 'new']
    // tests.docArray = [tests.docArray[2], tests.docArray[1], { c: 'new' }] as any
    await tests.save()

    console.log('CL: tests', tests)

    // const res = await getHistories('Tests', tests._id)
    // const res = await testsModel.getHistories('Tests', tests._id)
    const res = await testsModel.getDiffs('Tests', tests._id)
    // console.log('CL: res[1].diff.docArray', res[1].diff.docArray)
    console.log('CL: res[1].diff', res[1].diff.arr?._0[2])
    // console.log('CL: res', res[1].diff.arr ? res[1].diff.docArray : 'nope')
    // expect(res).toHaveLength(1)
  })

})

import mongoose, { Document } from 'mongoose'
import { testsSchema, testsSchemaInterface, schema2 } from './testsSchema'
import { ModelWithHistory } from '../src/types'

describe('diffHistory', () => {
  // let testsModel: mongoose.Model<{ a: string } & Document>
  let testsModel: ModelWithHistory<testsSchemaInterface>
  let schema2Model: ModelWithHistory<any>

  beforeAll(async () => {
    // await mongoose.connect('mongodb://localhost:27017/db')
    testsModel = mongoose.model('Tests', testsSchema) as any
    schema2Model = mongoose.model('Schema2', schema2) as any

    await testsModel.syncIndexes()
    await schema2Model.syncIndexes()
  })

  beforeEach(async () => {
    await testsModel.remove({})
    await schema2Model.remove({})
  })

  afterAll(async () => {
    await testsModel.remove({})
    await schema2Model.remove({})
    await mongoose.disconnect()
  })

  it('should add history when using findOneAndUpdate', async () => {
    const tests = new testsModel({ a: 'hi', b: { c: 'c' } })
    tests.__user = 'user1'
    await tests.save()

    const a = await testsModel.findOneAndUpdate({ a: 'hi' }, { a: 'ho' }, { __user: 'user2' } as any)

    expect(await testsModel.getHistory(tests._id)).toHaveLength(1)
    expect(await testsModel.getHistoryDiffs(tests._id)).toHaveLength(1)
    expect(await tests.getHistory()).toHaveLength(1)
    expect(await tests.getHistoryDiffs()).toHaveLength(1)
  })

  it('should add history when using save', async () => {
    const tests = new testsModel({ a: 'hi', b: { c: 'c' } })
    tests.__user = 'user1'
    await tests.save()

    tests.a = 'ho'
    tests.__user = 'user2'
    await tests.save()

    expect(await testsModel.getHistory(tests._id)).toHaveLength(1)
    expect(await testsModel.getHistoryDiffs(tests._id)).toHaveLength(1)
    expect(await tests.getHistory()).toHaveLength(1)
    expect(await tests.getHistoryDiffs()).toHaveLength(1)
  })

  /* it('should do something', async () => {
    const tests = new testsModel({ a: 'hi', b: { c: 'c' } })
    // const tests = new testsModel({ a: 'hi' })
    await tests.save()

    tests.a = 'ho'
    tests.arr = ['one', 'two', 'three']
    tests.docArray = [{ c: 'one' }, { c: 'two' }, { c: 'three' }] as any
    tests.__user = 'asdf'
    await tests.save()
    console.log('CL: tests', tests)

    tests.b = { c: 'd' } as any
    tests.arr = [tests.arr[2], tests.arr[1], 'new']
    // tests.docArray = [tests.docArray[2], tests.docArray[1], { c: 'new' }] as any
    tests.__user = 'bcde'
    await tests.save()

    console.log('CL: tests', tests)
    // tests.getHistoryDiffs()

    // const res = await getHistories('Tests', tests._id)
    // const res = await testsModel.getHistory('Tests', tests._id)
    // const res = await testsModel.getHistoryDiffs('Tests', tests._id)
    const resStatic = await testsModel.getHistoryDiffs(tests._id)
    console.log('CL: resStatic', resStatic)
    // console.log('CL: resStatic', resStatic)

    const resInstance = await tests.getHistory()
    console.log('CL: resInstance', resInstance)
    // console.log('CL: resInstance', resInstance)


    const resInstanceVers = await tests.getVersion(1)
    // console.log('CL: resInstanceVers', resInstanceVers)
    // const res = await testsModel.getHistoryDiffs()
    // console.log('CL: res[1].diff.docArray', res[1].diff.docArray)
    // console.log('CL: res[1].diff', res[1].diff.arr?._0[2])
    // console.log('CL: res', res[1].diff.arr ? res[1].diff.docArray : 'nope')
    // expect(res).toHaveLength(1)



    // const schema2 = new schema2Model({ a: 'a' })
    // await schema2.save()
    // schema2.a = 'b'
    // await schema2.save()

    // const resSchema2 = await tests.getHistoryDiffs('Schema2', schema2._id)
    // console.log('CL: resSchema2', resSchema2)


    // const historyModel = mongoose.model('History')
    // console.log('Histories', await historyModel.find())
  }) */

})

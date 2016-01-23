import BluebirdPromise = require("bluebird")

export const Promise: PromiseConstructor = BluebirdPromise

BluebirdPromise.config({
  longStackTraces: true,
})

export function printErrorAndExit(error: Error) {
  console.error(error.stack || error.message || error)
  process.exit(-1)
}

export async function executeFinally(promise: Promise<any>, task: (error?: Error) => Promise<any>): Promise<any> {
  let result: any = null
  try {
    result = await promise
  }
  catch (originalError) {
    try {
      await task(originalError)
    }
    catch (taskError) {
      throw new NestedError([originalError, taskError])
    }

    throw originalError
  }

  try {
    await task(null)
  }
  catch (taskError) {
    throw taskError
  }
  return result
}

export class NestedError extends Error {
  constructor(errors: Array<Error>, message: string = "Compound error: ") {
    let m = message
    for (let error of errors) {
      m += "\n" + error.message
    }
    super(m)
  }
}

export function all(promises: Array<Promise<any>>): Promise<any> {
  const errors: Array<Error> = []
  return Promise.all(promises.map(it => it.catch(it => errors.push(it))))
    .then(() => {
      if (errors.length === 1) {
        throw errors[0]
      }
      else if (errors.length > 1) {
        throw new NestedError(errors, "Cannot cleanup: ")
      }
    })
}
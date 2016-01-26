// Type definitions for bluebird 2.0.0
// Project: https://github.com/petkaantonov/bluebird
// Definitions by: Bart van der Schoor <https://github.com/Bartvds>, falsandtru <https://github.com/falsandtru>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module 'bluebird' {
  interface Disposer {
  }

  class PromiseImpl<T> implements Promise<T> {
    constructor(callback: (resolve: (thenableOrResult?: T | PromiseLike<T>) => void, reject: (error: any) => void, onCancel?: (handler: () => void) => void) => void)

    static config(options: any): void

    static all<T>(values: Iterable<T | PromiseLike<T>>): PromiseImpl<T[]>

    static mapSeries<T>(items: Iterable<T>, mapper: (item: T) => PromiseImpl<any>): PromiseImpl<any>

    static reject(error: Error): PromiseImpl<any>

    /**
     * Returns a function that will wrap the given `nodeFunction`. Instead of taking a callback, the returned function will return a promise whose fate is decided by the callback behavior of the given node function. The node function should conform to node.js convention of accepting a callback as last argument and calling that callback with error as the first argument and success value on the second argument.
     *
     * If the `nodeFunction` calls its callback with multiple success values, the fulfillment value will be an array of them.
     *
     * If you pass a `receiver`, the `nodeFunction` will be called as a method on the `receiver`.
     */
    static promisify<T>(func: (callback: (err: any, result: T) => void) => void, receiver?: any): () => PromiseImpl<T>;
    static promisify<T, A1>(func: (arg1: A1, callback: (err: any, result: T) => void) => void, receiver?: any): (arg1: A1) => PromiseImpl<T>;
    static promisify<T, A1, A2>(func: (arg1: A1, arg2: A2, callback: (err: any, result: T) => void) => void, receiver?: any): (arg1: A1, arg2: A2) => PromiseImpl<T>;
    static  promisify<T, A1, A2>(func: (arg1: A1, arg2: A2, callback: (error: Error) => void) => void, receiver?: any): (arg1: A1, arg2: A2) => PromiseImpl<T>;
    static promisify<T, A1, A2, A3>(func: (arg1: A1, arg2: A2, arg3: A3, callback: (err: any, result: T) => void) => void, receiver?: any): (arg1: A1, arg2: A2, arg3: A3) => PromiseImpl<T>;
    static promisify<T, A1, A2, A3, A4>(func: (arg1: A1, arg2: A2, arg3: A3, arg4: A4, callback: (err: any, result: T) => void) => void, receiver?: any): (arg1: A1, arg2: A2, arg3: A3, arg4: A4) => PromiseImpl<T>;
    static promisify<T, A1, A2, A3, A4, A5>(func: (arg1: A1, arg2: A2, arg3: A3, arg4: A4, arg5: A5, callback: (err: any, result: T) => void) => void, receiver?: any): (arg1: A1, arg2: A2, arg3: A3, arg4: A4, arg5: A5) => PromiseImpl<T>;
    static promisify(nodeFunction: Function, receiver?: any): Function;

    static resolve<T>(value: T | PromiseLike<T>): PromiseImpl<T>
    static resolve(): PromiseImpl<void>

    then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => TResult | PromiseLike<TResult>): PromiseImpl<TResult>;
    then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => void): PromiseImpl<TResult>;

    //noinspection ReservedWordAsName
    catch(onrejected?: (reason: any) => T | PromiseLike<T>): PromiseImpl<T>
    //noinspection ReservedWordAsName
    catch(onrejected?: (reason: any) => void): PromiseImpl<T>;

    [Symbol.toStringTag]: any

    disposer(disposer: (result: T, promise: Promise<any>) => Promise<any> | void): Disposer

    thenReturn<T>(result: T): PromiseImpl<T>
  }

  export = PromiseImpl;
}
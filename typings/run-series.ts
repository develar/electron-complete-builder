declare module "run-series" {
  function series(tasks: Array<(callback: (error: any, result: any) => void) => void>[], callback: ((error: any, results: any[] = null) => void)): void

  export = series
}

declare module "run-parallel" {
  function parallel(tasks: Array<(callback: (error: any, result: any) => void) => void>, callback: ((error: any, results: any[] = null) => void)): void

  export = parallel
}
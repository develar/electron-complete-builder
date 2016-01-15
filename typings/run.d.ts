declare module "run-series" {
  function series(tasks: Array<(callback: (error: any, result: any) => void) => void>[], callback: ((error: any, results?: any[]) => void)): void

  export = series
}

declare module "run-parallel" {
  function parallel(tasks: Array<(callback: (error: any, result: any) => void) => void>, callback: ((error: any, results?: any[]) => void)): void

  export = parallel
}

declare module "run-auto" {
  function auto(tasks: { [name: string]: Array<((callback: (error: any, result: any) => void) => void) | string>; }, callback: ((error: any, results?: any[]) => void)): void

  export = auto
}
declare module "ghGot" {
  export interface GhGotOptions {
    token: string
  }
}

declare module "gh-got" {
  import { GhGotOptions } from "ghGot"

  function ghGot(url: string, options: GhGotOptions): Promise<any>

  export = ghGot
}
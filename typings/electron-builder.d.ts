declare module "electron-builder-tf/lib/linux" {
  class Linux {
    build(options: any, callback: (error: Error, path: string) => void): void
  }
  
  function init(): Linux
}
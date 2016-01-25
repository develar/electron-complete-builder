declare module "gh-release" {
  interface GetReleaseResult extends Release {
  }

  interface Release {
    id: number
    draft: boolean

    upload_url: string
  }
}
declare module "gh-release" {
  interface GetReleaseResult extends Release {
  }

  interface Release {
    id: number
    tag_name: string

    draft: boolean

    upload_url: string
  }

  interface Asset {
    id: number
    name: string
  }
}
export type UploadMode = 'choose' | 'record'

export type SelectedVideo = {
  blob: Blob
  url: string
  name: string
  size: number
}

export type StoredVideo = {
  id: string
  blob: Blob
  name: string
  size: number
  type: string
  createdAt: number
}

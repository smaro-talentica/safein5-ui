import { VideoUpload } from '@/components/feature/VideoUpload'

export function UploadVideo() {
  const handleUpload = async (file: File) => {
    // TODO: replace with a real upload to your API.
    // e.g. const body = new FormData(); body.append('video', file);
    //      await fetch('/api/videos', { method: 'POST', body })
    console.log('Uploading video:', file.name, file.size)
  }

  return <VideoUpload onUpload={handleUpload} />
}

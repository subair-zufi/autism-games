// The three public/ directories whose contents are cached for offline play.
// Shared by the service worker (cache-first serving) and the manifest checks.
const MEDIA_DIRS = ['/videos/', '/emotions/', '/groups/']

export function isMediaPath(pathname: string): boolean {
  return MEDIA_DIRS.some((dir) => pathname.includes(dir))
}

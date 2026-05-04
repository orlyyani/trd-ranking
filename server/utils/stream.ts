/**
 * Converts a YouTube watch/share URL to an embed URL for iframe use.
 * Passes through embed URLs and non-YouTube URLs unchanged.
 */
export function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)

    // Already an embed URL
    if (u.pathname.startsWith('/embed/')) return url

    // youtube.com/watch?v=ID
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.searchParams.has('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`
    }

    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`
    }

    return url
  } catch {
    return url
  }
}

/**
 * Helper to get a proxied image URL for external images
 * to avoid CORS, hotlinking, and Referrer policy blocks.
 */
export function getProxiedImageUrl(url: string): string {
  if (!url) return "";
  
  // If it's already a base64 data URI, blob URL, or local public asset, return as-is
  if (
    url.startsWith("data:") || 
    url.startsWith("blob:") || 
    url.startsWith("/") || 
    url.startsWith("./") || 
    url.startsWith("http://localhost:3000/")
  ) {
    return url;
  }

  // Bypass proxying for Wikimedia and Alamy as browser direct fetch with no-referrer works flawlessly
  if (url.includes("wikimedia.org") || url.includes("alamy.com")) {
    return url;
  }
  
  // If it is already proxied, do not double proxy
  if (url.includes("/api/proxy-image")) {
    return url;
  }
  
  // Return the proxied URL
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

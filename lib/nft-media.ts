export function isVideoUrl(value: string | null | undefined) {
  if (!value) return false;
  if (/^data:video\/mp4[;,]/i.test(value)) return true;
  try {
    const url = new URL(value, "https://marketplace.local");
    return /\.mp4$/i.test(url.pathname) || /\.mp4(?:$|[?#])/i.test(url.searchParams.get("filename") ?? "");
  } catch { return false; }
}

export function nftMedia(image: string | null, animation: string | null) {
  const videoUrl = isVideoUrl(animation) ? animation : isVideoUrl(image) ? image : null;
  return { imageUrl: videoUrl === image ? null : image, videoUrl };
}

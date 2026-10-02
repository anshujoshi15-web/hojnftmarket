export function isVideoUrl(value: string | null | undefined) {
  if (!value) return false;
  if (/^data:video\/mp4[;,]/i.test(value)) return true;
  try {
    const url = new URL(value, "https://marketplace.local");
    return /\.mp4$/i.test(url.pathname) || /\.mp4(?:$|[?#])/i.test(url.searchParams.get("filename") ?? "");
  } catch { return false; }
}

export function directIpfsImageUrl(value: string | null | undefined) {
  if (!value) return null;
  let path: string;
  if (value.startsWith("ipfs://ipfs/")) path = value.slice("ipfs://ipfs/".length);
  else if (value.startsWith("ipfs://")) path = value.slice("ipfs://".length);
  else {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      const marker = url.pathname.indexOf("/ipfs/");
      if (marker < 0) return null;
      path = url.pathname.slice(marker + "/ipfs/".length);
    } catch { return null; }
  }
  const cid = path.split("/", 1)[0];
  if (!/^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{30,})$/.test(cid)) return null;
  return `https://gateway.pinata.cloud/ipfs/${path}`;
}

export function nftMedia(image: string | null, animation: string | null) {
  const videoUrl = isVideoUrl(animation) ? animation : isVideoUrl(image) ? image : null;
  return { imageUrl: videoUrl === image ? null : image, videoUrl };
}

"use client";

import type { CSSProperties, SyntheticEvent } from "react";

type Props = {
  src: string;
  poster?: string | null;
  label: string;
  className?: string;
  style?: CSSProperties;
  onError?: (event: SyntheticEvent<HTMLVideoElement>) => void;
};

export function NftCardVideo({ src, poster, label, className, style, onError }: Props) {
  return <video
    src={src}
    poster={poster ?? undefined}
    aria-label={label}
    className={className}
    style={style}
    muted
    playsInline
    preload="metadata"
    onLoadedMetadata={event => {
      if (poster) return;
      const video = event.currentTarget;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      try { video.currentTime = Math.min(0.5, video.duration / 4); }
      catch { /* Some hosts do not support seeking; the browser may still show the first frame. */ }
    }}
    onSeeked={event => event.currentTarget.pause()}
    onError={onError}
  />;
}

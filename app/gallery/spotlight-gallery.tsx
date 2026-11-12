"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, Maximize2, Share2, X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { siteOrigin } from "@/lib/aura-discovery";

const contract = "0xa992ae2d48ab978410d7a56f13344edafcde2f3f";
const chainId = 109;
const edition = "LumiBots Droid Army · Shibarium";
const artworkGateway = "https://gateway.pinata.cloud/ipfs/QmWuwyhjTmaYxuzsnTcc6cV9pNBxpfAsA6QQDToqKUdx4b";
const galleryUrl = `${siteOrigin}/gallery`;
const works = [
  {
    title: "LumiBot #703",
    tokenId: "703",
    traits: ["Starry night", "Gold chain", "Star headwear"],
    alt: "A rust-colored pixel droid with a gold star against a night sky",
    story: "A gold star and yellow eyes light up the starry backdrop. A gold chain stands out against the droid’s rust-colored body.",
  },
  {
    title: "LumiBot #1719",
    tokenId: "1719",
    traits: ["Halo", "Silver earrings", "Green eyes"],
    alt: "A smiling gunmetal droid with a halo against a rose backdrop",
    story: "A halo and silver earrings frame this smiling droid. Green eyes stand out against the rose backdrop.",
  },
  {
    title: "LumiBot #2790",
    tokenId: "2790",
    traits: ["Dollar-sign hat", "Diamond chain", "Orange eyes"],
    alt: "A smirking droid with a diamond chain against red and black stripes",
    story: "A dollar-sign hat and diamond chain give this droid a flash of shine. Orange eyes echo the warmth of the red stripes.",
  },
  {
    title: "LumiBot #2789",
    tokenId: "2789",
    traits: ["Green Lumi hat", "Diamond eyes", "Rust finish"],
    alt: "A rust-colored droid with diamond eyes and a green Lumi hat",
    story: "Diamond eyes and a green Lumi hat give the rust-colored droid its character against a simple tan backdrop.",
  },
].map(work => ({
  ...work,
  image: `${artworkGateway}/${work.tokenId}.png`,
  href: `/nft/${chainId}/${contract}/${work.tokenId}`,
}));

function GalleryArtwork({ work, selected, fullSize = false }: { work: (typeof works)[number]; selected: boolean; fullSize?: boolean }) {
  const [unavailable, setUnavailable] = useState(false);

  return unavailable ? <span className="spotlight-art-unavailable">Artwork unavailable</span> : (
    <Image src={work.image} alt={work.alt} fill unoptimized loading={selected && !fullSize ? "eager" : "lazy"}
      sizes={fullSize ? "100vw" : "(max-width: 600px) 64vw, 350px"} onError={() => setUnavailable(true)} />
  );
}

export default function SpotlightGallery() {
  const [turn, setTurn] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [tour, setTour] = useState<"idle" | "playing" | "paused">("idle");
  const active = ((turn % works.length) + works.length) % works.length;
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const selected = works[active];
  const viewer = useRef<HTMLDialogElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [showShareLink, setShowShareLink] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const shareUrl = `${galleryUrl}#artwork-${selected.tokenId}`;

  useEffect(() => {
    function openLinkedArtwork() {
      const index = works.findIndex(work => location.hash === `#artwork-${work.tokenId}`);
      if (index < 0) return;
      setTour("idle");
      setTurn(index);
    }
    const frame = requestAnimationFrame(openLinkedArtwork);
    window.addEventListener("hashchange", openLinkedArtwork);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openLinkedArtwork);
    };
  }, []);

  useEffect(() => {
    if (tour !== "playing") return;
    const timeout = window.setTimeout(() => {
      if (active === works.length - 1) setTour("idle");
      else setTurn(current => current + 1);
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [active, tour]);

  function moveArtwork(direction: number) {
    setTour(current => current === "playing" ? "paused" : current);
    setTurn(current => current + direction);
  }

  function openViewer() {
    setTour(current => current === "playing" ? "paused" : current);
    viewer.current?.showModal();
  }

  async function shareSpotlight() {
    setActionStatus("");
    setShowShareLink(false);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${selected.title} · AURA Artist Spotlight`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setActionStatus("Artwork link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShowShareLink(true);
      setActionStatus("Copy the artwork link below.");
    }
  }

  async function captureScene() {
    const stage = scene.current;
    const { CropTarget } = window as Window & {
      CropTarget?: { fromElement: (element: Element) => Promise<object> };
    };
    if (!stage || !CropTarget || !navigator.mediaDevices?.getDisplayMedia) {
      setActionStatus("Use desktop Chrome to capture the gallery scene.");
      return;
    }

    setTour(current => current === "playing" ? "paused" : current);
    setCapturing(true);
    setActionStatus("Choose this gallery tab. The PNG will contain only the 3D room.");
    let stream: MediaStream | undefined;
    const video = document.createElement("video");
    try {
      stage.scrollIntoView({ block: "center" });
      const options = { video: true, audio: false, preferCurrentTab: true };
      stream = await navigator.mediaDevices.getDisplayMedia(options);
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
        cropTo?: (target: object) => Promise<void>;
      };
      if (!track?.cropTo || track.getSettings().displaySurface !== "browser") {
        setActionStatus("Select this gallery tab to capture the room.");
        return;
      }
      await track.cropTo(await CropTarget.fromElement(stage));
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      const bounds = stage.getBoundingClientRect();
      // Wait for a frame with the room's dimensions before exporting.
      const capturedFrame = await new Promise<VideoFrameCallbackMetadata>((resolve, reject) => {
        let callback: number;
        const timeout = window.setTimeout(() => {
          video.cancelVideoFrameCallback(callback);
          reject(new Error("No cropped gallery frame"));
        }, 4000);
        const checkFrame: VideoFrameRequestCallback = (_, frame) => {
          if (Math.abs(frame.width / frame.height - bounds.width / bounds.height) < .015) {
            window.clearTimeout(timeout);
            resolve(frame);
          } else {
            callback = video.requestVideoFrameCallback(checkFrame);
          }
        };
        callback = video.requestVideoFrameCallback(checkFrame);
      });

      const canvas = document.createElement("canvas");
      canvas.width = capturedFrame.width;
      canvas.height = capturedFrame.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("PNG unavailable");
      const url = URL.createObjectURL(png);
      const download = document.createElement("a");
      download.href = url;
      download.download = `aura-gallery-lumibot-${selected.tokenId}.png`;
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setActionStatus("Gallery image ready to save.");
    } catch (error) {
      const cancelled = error instanceof DOMException && ["AbortError", "NotAllowedError"].includes(error.name);
      setActionStatus(cancelled ? "Capture cancelled or blocked by the browser." : "Couldn’t capture the scene. Select this gallery tab and try again.");
    } finally {
      video.srcObject = null;
      stream?.getTracks().forEach(track => track.stop());
      setCapturing(false);
    }
  }

  function chooseArtwork(index: number) {
    setTour(current => current === "playing" ? "paused" : current);
    const distance = (index - active + works.length) % works.length;
    setTurn(current => current + (distance > works.length / 2 ? distance - works.length : distance));
  }

  return (
    <main className="spotlight-page">
      <header className="spotlight-heading">
        <div><p>AURA BY JOSHI</p><h1>Artist Spotlight</h1></div>

      </header>
      <section className="spotlight-gallery" aria-label="3D exhibition" tabIndex={0}
        onKeyDown={event => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            moveArtwork(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}>
        <div className="spotlight-stage" ref={scene}
          onPointerDown={event => {
            if (!event.isPrimary) return;
            swiped.current = false;
            pointerStart.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerCancel={() => { pointerStart.current = null; }}
          onPointerUp={event => {
            const start = pointerStart.current;
            pointerStart.current = null;
            if (!event.isPrimary || !start) return;
            const distance = event.clientX - start.x;
            if (Math.abs(distance) < 40 || Math.abs(distance) < Math.abs(event.clientY - start.y)) return;
            swiped.current = true;
            moveArtwork(distance < 0 ? 1 : -1);
          }}
          onClickCapture={event => {
            if (event.detail === 0 || !swiped.current) return;
            event.preventDefault();
            event.stopPropagation();
            swiped.current = false;
          }}>
          <div className="spotlight-room" data-zoomed={zoomed} style={{ "--room-turn": `${turn * 90}deg` } as CSSProperties}>
            <div className="spotlight-floor" aria-hidden="true" />
            {works.map((work, index) => {
              const isSelected = index === active;
              const opposite = (index - active + works.length) % works.length === 2;
              return <div className="spotlight-wall" key={work.title}
                inert={opposite}
                style={{ "--wall-angle": `${index * -90}deg` } as CSSProperties}>
                <div className="spotlight-panel" aria-hidden="true" />
                <div className="spotlight-pendant" aria-hidden="true" />
                <div className="spotlight-planter" aria-hidden="true" />
                <div className="spotlight-picture">
                  <div className="spotlight-light" aria-hidden="true" />
                  <div className="spotlight-frame">
                    {isSelected
                      ? <button type="button" onClick={openViewer} aria-label={`View ${work.title} full screen`}><GalleryArtwork work={work} selected /></button>
                      : <button type="button" tabIndex={opposite ? -1 : undefined} onClick={() => chooseArtwork(index)} aria-label={`Show ${work.title} on the gallery wall`}><GalleryArtwork work={work} selected={false} /></button>}
                  </div>
                  <span className="spotlight-plaque">{work.title} · Shibarium</span>
                </div>
              </div>;
            })}
          </div>
        </div>
        <div className="spotlight-controls">
          <button type="button" onClick={() => moveArtwork(-1)} aria-label="Previous artwork"><ArrowLeft size={18} /></button>
          <div className="spotlight-caption" aria-live="polite" aria-atomic="true">
            <span>{active + 1} / {works.length}</span>
            <h2>{selected.title}</h2>
          </div>
          <button type="button" onClick={() => moveArtwork(1)} aria-label="Next artwork"><ArrowRight size={18} /></button>
        </div>
      </section>
      <section className="spotlight-tour" aria-label="Guided tour">
        <div className="spotlight-actions">
          {tour === "idle" ? (
            <button type="button" onClick={() => {
              setTurn(current => current - active);
              setTour("playing");
            }}>Start tour</button>
          ) : (
            <>
              <button type="button" onClick={() => setTour(tour === "playing" ? "paused" : "playing")}>
                {tour === "playing" ? "Pause tour" : "Resume tour"}
              </button>
              <button type="button" onClick={() => setTour("idle")}>Exit tour</button>
            </>
          )}
        </div>
        {tour !== "idle" && (
          <div className="spotlight-tour-note" role="status">
            <strong>{selected.title} · Stop {active + 1} of {works.length}</strong>
            <p>{selected.story}</p>
          </div>
        )}
      </section>
      <section className="spotlight-details" aria-label="Selected artwork details">
        <div>
          <h2>{selected.title}</h2>
          <p className="spotlight-edition">{edition}</p>
          <p>{selected.story}</p>
          <ul className="spotlight-traits" aria-label="Artwork traits">
            {selected.traits.map(trait => <li key={trait}>{trait}</li>)}
          </ul>
        </div>
        <div className="spotlight-actions">
          <button type="button" onClick={() => setZoomed(current => !current)}>
            {zoomed ? <ZoomOut size={16} aria-hidden="true" /> : <ZoomIn size={16} aria-hidden="true" />}
            {zoomed ? "Zoom out" : "Zoom in"}
          </button>
          <button type="button" onClick={openViewer}>
            <Maximize2 size={16} aria-hidden="true" /> Full screen
          </button>
          <Link className="spotlight-detail" href={selected.href}>View NFT <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <button type="button" onClick={shareSpotlight}><Share2 size={16} aria-hidden="true" /> Share</button>
          <button type="button" onClick={captureScene} disabled={capturing}>
            <Camera size={16} aria-hidden="true" /> {capturing ? "Capturing…" : "Capture image"}
          </button>
        </div>
        <p role="status">{actionStatus}</p>
        {showShareLink && <input aria-label="Artwork link" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} />}
      </section>
      <nav className="spotlight-works" aria-label="Choose artwork">
        {works.map((work, index) => (
          <button type="button" key={work.title} aria-label={`Show ${work.title}`} aria-pressed={index === active} onClick={() => chooseArtwork(index)}>
            <span className="spotlight-thumbnail"><GalleryArtwork work={work} selected={false} /></span>
            <span>{work.title}</span>
          </button>
        ))}
      </nav>
      <section className="spotlight-artist" aria-labelledby="spotlight-artist-name">
        <div className="spotlight-artist-portrait"><GalleryArtwork work={works[0]} selected /></div>
        <div>
          <h2 id="spotlight-artist-name">LumiBots Droid Army</h2>
          <p>LumiBots Droid Army is a collection of pixel-art robots on Shibarium. This spotlight features four droids from AURA’s marketplace, each with its own combination of colors and accessories.</p>
          <blockquote>
            <p>“Illuminate The Future”</p>
            <cite><Link href={works[0].href}>LumiBots Droid Army</Link></cite>
          </blockquote>
        </div>
      </section>
      <dialog className="spotlight-viewer" ref={viewer} aria-labelledby="spotlight-viewer-title">
        <div className="spotlight-viewer-header">
          <h2 id="spotlight-viewer-title">{selected.title}</h2>
          <form method="dialog"><button type="submit" aria-label="Close full-screen artwork"><X size={22} /></button></form>
        </div>
        <div className="spotlight-viewer-image"><GalleryArtwork key={selected.tokenId} work={selected} selected fullSize /></div>
      </dialog>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// Planned launch at midnight GMT, as specified for the Discover countdown.
const plannedLaunch = Date.parse("2026-10-25T00:00:00Z");

export default function AstralsDiscoverDrop() {
  const [now,setNow]=useState<number>();
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const initial=setTimeout(tick,0);
    const timer=setInterval(tick,1000);
    return()=>{clearTimeout(initial);clearInterval(timer);};
  },[]);
  const seconds=now===undefined?undefined:Math.max(0,Math.ceil((plannedLaunch-now)/1000));
  const units=seconds===undefined?[]:[
    [Math.floor(seconds/86400),"Days"],
    [Math.floor(seconds/3600)%24,"Hours"],
    [Math.floor(seconds/60)%60,"Minutes"],
    [seconds%60,"Seconds"],
  ] as const;
  return <section className="astrals-discover-drop" aria-labelledby="astrals-discover-title">
    <Link href="/drops" className="astrals-discover-art" aria-label="Explore the Joshi Astrals drop">
      <Image src="https://joshiastrals.thehouseofjoshi.com/branding/launch-hero.jpg" alt="Joshi Astrals lavender stone companion framed by a golden celestial portal" width={1254} height={1254} sizes="(max-width: 700px) 100vw, 280px" />
    </Link>
    <div className="astrals-discover-copy">
      <span className="royal-section-label">ARC · {seconds===0?"UPCOMING DROP":"MINTING SOON"}</span>
      <h2 id="astrals-discover-title">Joshi Astrals</h2>
      <p>Rooted in Earth. Written in the stars.</p>
      <p>25 USDC + gas · No wallet limit · No buyer whitelist</p>
      <p className="astrals-discover-date">Planned public mint · 25 October 2026, 12:00 AM GMT</p>
      {seconds===undefined?<p>Loading countdown…</p>:seconds>0?<div className="astrals-discover-countdown" role="timer" aria-label="Countdown to the planned public mint" aria-live="off">{units.map(([value,label])=><div key={label}><strong>{String(value).padStart(2,"0")}</strong><span>{label}</span></div>)}</div>:<p>Planned launch time reached. Check live mint availability on Drops.</p>}
      <Link href="/drops" className="royal-view-all">{seconds===0?"Check mint availability":"View drop"} ↗</Link>
      <small>Final availability is controlled by the official OpenSea Drop.</small>
    </div>
  </section>;
}

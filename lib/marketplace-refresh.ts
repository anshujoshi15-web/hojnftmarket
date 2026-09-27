export const MARKETPLACE_REFRESH_INTERVAL = 10_000;
const EVENT_NAME = "hoj-marketplace-updated";
const CHANNEL_NAME = "hoj-marketplace-updates";

export function announceMarketplaceUpdate(chainId: number) {
  window.dispatchEvent(new CustomEvent<number>(EVENT_NAME, { detail: chainId }));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(chainId);
      channel.close();
    } catch { /* A completed transaction must not fail on browser messaging. */ }
  }
}

export function onMarketplaceUpdate(refresh: (chainId: number) => void) {
  const local = (event: Event) => refresh((event as CustomEvent<number>).detail);
  window.addEventListener(EVENT_NAME, local);
  let channel:BroadcastChannel|null=null;
  try { if (typeof BroadcastChannel !== "undefined") channel=new BroadcastChannel(CHANNEL_NAME); }
  catch { /* Same-tab events and polling still refresh the page. */ }
  if (channel) channel.onmessage = event => {
    if (typeof event.data === "number") refresh(event.data);
  };
  return () => {
    window.removeEventListener(EVENT_NAME, local);
    channel?.close();
  };
}

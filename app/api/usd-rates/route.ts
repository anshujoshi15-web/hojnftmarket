import { NextResponse } from "next/server";

const ids:Record<string,string>={
  ETH:"ethereum",
  WETH:"ethereum",
  CRO:"crypto-com-chain",
  BONE:"bone-shibaswap",
  POL:"polygon-ecosystem-token",
  USDC:"usd-coin",
  APE:"apecoin",
};

export async function GET(){
  try{
    const url=new URL("https://api.coingecko.com/api/v3/simple/price");
    url.searchParams.set("ids",[...new Set(Object.values(ids))].join(","));
    url.searchParams.set("vs_currencies","usd");
    url.searchParams.set("include_last_updated_at","true");
    const response=await fetch(url,{next:{revalidate:300},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error(`Price service returned ${response.status}`);
    const data=await response.json() as Record<string,{usd?:number;last_updated_at?:number}>;
    const rates:Record<string,number>={};
    const now=Math.floor(Date.now()/1000);
    for(const [currency,id] of Object.entries(ids)){
      const quote=data[id];
      if(quote&&typeof quote.usd==="number"&&Number.isFinite(quote.usd)&&quote.usd>0&&typeof quote.last_updated_at==="number"&&now-quote.last_updated_at<3600)rates[currency]=quote.usd;
    }
    return NextResponse.json({rates},{headers:{"Cache-Control":"public, max-age=300, s-maxage=300, stale-while-revalidate=300"}});
  }catch{
    return NextResponse.json({rates:{}},{status:503,headers:{"Cache-Control":"public, max-age=60"}});
  }
}

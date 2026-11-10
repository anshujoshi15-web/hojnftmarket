import {parseEther} from "viem";

export function marketPriceBounds(minimum:string,maximum:string){
  function parse(value:string){
    if(!value.trim())return undefined;
    if(!/^\d+(?:\.\d{1,18})?$/.test(value.trim())||value.trim().length>96)throw Error("Enter a positive price with up to 18 decimal places.");
    return parseEther(value.trim());
  }
  try{
    const min=parse(minimum),max=parse(maximum);
    if(min!==undefined&&max!==undefined&&min>max)return {error:"Minimum price must be at or below maximum price."};
    return {min,max};
  }catch(error){return {error:(error as Error).message};}
}

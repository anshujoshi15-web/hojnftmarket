export function PurchaseSummary({network,source,amount,estimate=false}:{network:string;source:string;amount:string;estimate?:boolean}){
  return <div className="hoj-purchase-summary" aria-label="Purchase details">
    <dl>
      <div><dt>Listing source</dt><dd>{source}</dd></div>
      <div><dt>Network</dt><dd>{network}</dd></div>
      <div><dt>{estimate?"Listed price before gas":"Payment before gas"}</dt><dd>{amount}</dd></div>
    </dl>
    <p>{estimate?"In-app checkout is available for eligible native-currency orders. Your wallet shows the final total with gas.":"No token approval is needed for this purchase. Your wallet shows the final total with gas."}</p>
  </div>;
}

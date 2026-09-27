import { DirectoryPage } from "../directory-page";

export default function ResourcesPage(){
  return <DirectoryPage eyebrow="RESOURCES" title="Marketplace Resources" intro="Learn how the marketplace works, find answers, and understand the House of Joshi." cards={[
    {eyebrow:"GUIDES",title:"How to use",description:"Follow the steps for buying, selling, V8 bulk listing, approvals, and withdrawals.",href:"/learn",icon:"book"},
    {eyebrow:"ASSISTANCE",title:"Help Centre",description:"Find practical answers about using the marketplace across supported networks.",href:"/help-centre",icon:"help"},
    {eyebrow:"QUESTIONS",title:"FAQ",description:"Find answers about supported chains, gas, earlier V7 listings, and indexing warnings.",href:"/faq",icon:"help"},
    {eyebrow:"TRADING",title:"How it works",description:"Understand custody, fees, royalties, collection approvals, and contract upgrades.",href:"/protocol",icon:"book"},
    {eyebrow:"THE HOUSE",title:"About",description:"Read about the House of Joshi and the principles behind the NFT Marketplace.",href:"/about",icon:"collection"},
  ]}/>;
}

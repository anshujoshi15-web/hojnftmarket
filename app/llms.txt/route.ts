import { llmsText } from "@/lib/aura-discovery";

export function GET() {
  return new Response(llmsText, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

import { NextResponse, type NextRequest } from "next/server";
import { homeMarkdown, prefersMarkdown, siteUrl } from "@/lib/aura-discovery";

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  if (request.headers.get("rsc") !== "1" && prefersMarkdown(request.headers.get("accept"))) {
    return new NextResponse(request.method === "HEAD" ? null : homeMarkdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
        "Vary": "Accept, RSC",
        "Link": `<${siteUrl("/")}>; rel="canonical"`,
      },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };

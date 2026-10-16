import { requestLanguage } from "@/lib/locale";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return Response.json(requestLanguage(request.headers), {
    headers: { "Cache-Control": "private, no-store", Vary: "Accept-Language" },
  });
}

import { getStore, idForEndpoint } from "@/lib/push/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { endpoint?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const id = body.id ?? (body.endpoint ? idForEndpoint(body.endpoint) : null);
  if (!id) return Response.json({ error: "missing id or endpoint" }, { status: 400 });

  const store = await getStore();
  await store.remove(id);
  return Response.json({ ok: true });
}

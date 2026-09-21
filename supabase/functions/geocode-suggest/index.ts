import "@supabase/functions-js/edge-runtime.d.ts";

const OPENCAGE_API_KEY = Deno.env.get("OPENCAGE_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    if (q.length < 3) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!OPENCAGE_API_KEY) throw new Error("OPENCAGE_API_KEY not configured");

    const ocUrl = new URL("https://api.opencagedata.com/geocode/v1/json");
    ocUrl.searchParams.set("q", q);
    ocUrl.searchParams.set("key", OPENCAGE_API_KEY);
    ocUrl.searchParams.set("limit", "5");
    ocUrl.searchParams.set("no_annotations", "1");

    const res = await fetch(ocUrl);
    if (!res.ok) throw new Error(`OpenCage request failed: ${res.status}`);
    const data = await res.json();

    const suggestions = (data.results ?? []).map((r: { formatted: string }) => r.formatted);
    // De-duplicate — OpenCage sometimes returns near-identical formatted strings.
    const unique = Array.from(new Set(suggestions));

    return new Response(JSON.stringify({ suggestions: unique }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

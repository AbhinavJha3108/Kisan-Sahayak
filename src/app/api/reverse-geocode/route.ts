import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api";
import { ReverseGeocodeSchema } from "@/lib/schemas";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const parsed = ReverseGeocodeSchema.parse({
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon")
  });
  const { lat, lon } = parsed;

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&addressdetails=1`,
    {
      headers: { "User-Agent": "kisan-sahayak-next/1.0" }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Reverse geocode failed: ${text}` }, { status: 502 });
  }

  const data = await response.json();
  const addr = data?.address || {};
  const city = addr.city || addr.town || addr.village || addr.county || "";
  const state = addr.state || "";
  const country = addr.country || "";

  const location = [city, state, country].filter(Boolean).join(", ") || "Unknown location";
  return NextResponse.json({ location, lat, lon });
});

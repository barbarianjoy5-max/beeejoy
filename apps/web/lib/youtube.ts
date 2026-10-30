// ==============================================================================
// BEEEJOY YouTube Embed URL Helper
// Validates and extracts video IDs for responsive, clean iframe embedding.
// ==============================================================================

export function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    const allowedHosts = new Set([
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ]);

    if (!allowedHosts.has(host)) {
      return null;
    }

    // 1. Short links: youtu.be/VIDEO_ID
    if (host === "youtu.be") {
      const pathMatch = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})(?:$|\/|\?)/);
      return pathMatch ? pathMatch[1] : null;
    }

    // 2. Standard watch: youtube.com/watch?v=VIDEO_ID
    if (parsed.pathname === "/watch") {
      const v = parsed.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
      return null;
    }

    // 3. Embed & Shorts: youtube.com/embed/VIDEO_ID or youtube.com/shorts/VIDEO_ID
    const embedOrShortsMatch = parsed.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})(?:$|\/|\?)/);
    if (embedOrShortsMatch) {
      return embedOrShortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  // Use youtube-nocookie.com for privacy and faster performance
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

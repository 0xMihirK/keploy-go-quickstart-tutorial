import { ImageResponse } from "next/og";

export const alt = "Test a Go API by recording it: a hands-on Keploy tutorial";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Weight = 400 | 500 | 700;

/**
 * The site's fonts as TTF, fetched once at build time. Without network the card
 * still renders, in the renderer's built-in font.
 */
async function loadFonts() {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;700&family=JetBrains+Mono:wght@500",
    ).then((r) => r.text());
    // Without a browser user agent, Google Fonts serves TrueType, which the renderer needs.
    const faces = [...css.matchAll(/font-family: '([^']+)';[^}]*?font-weight: (\d+);[^}]*?src: url\(([^)]+)\) format\('truetype'\)/g)];
    return await Promise.all(
      faces.map(async ([, name, weight, url]) => ({
        name,
        weight: Number(weight) as Weight,
        style: "normal" as const,
        data: await fetch(url).then((r) => r.arrayBuffer()),
      })),
    );
  } catch {
    return [];
  }
}

const reel = (color: string) => (
  <div
    style={{
      width: 64,
      height: 64,
      borderRadius: 999,
      border: `7px solid ${color}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div style={{ width: 16, height: 16, borderRadius: 999, background: color }} />
  </div>
);

export default async function Image() {
  const fonts = await loadFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0c0f14",
          color: "#e7eaf0",
          padding: "72px 80px",
          fontFamily: "Instrument Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {reel("#ff5c61")}
          {reel("#2ec4bc")}
          <div style={{ marginLeft: 18, fontSize: 30, color: "#8b93a1" }}>
            Keploy tutorial
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
            Test a Go API by recording it
          </div>
          <div style={{ marginTop: 26, fontSize: 32, color: "#b4bcc8", maxWidth: 940, lineHeight: 1.35 }}>
            Record real traffic and database calls, then replay them with the database switched off.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 24,
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            color: "#7d8696",
          }}
        >
          <span style={{ color: "#ff8a8e" }}>● keploy record</span>
          <span style={{ color: "#5fe0d8", marginLeft: 24 }}>▶ keploy test</span>
          <span style={{ marginLeft: 24 }}>Gin + MongoDB sample</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

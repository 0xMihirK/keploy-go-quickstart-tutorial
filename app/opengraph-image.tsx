import { ImageResponse } from "next/og";

export const alt = "Test a Go API by recording it: a hands-on Keploy tutorial";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default function Image() {
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
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {reel("#ff5c61")}
          {reel("#2ec4bc")}
          <div style={{ marginLeft: 18, fontSize: 30, color: "#8b93a1" }}>
            Keploy + Go quickstart
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
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
            fontFamily: "monospace",
            color: "#7d8696",
          }}
        >
          <span style={{ color: "#ff8a8e" }}>● keploy record</span>
          <span style={{ color: "#5fe0d8", marginLeft: 24 }}>▶ keploy test</span>
          <span style={{ marginLeft: 24 }}>Gin + MongoDB sample</span>
        </div>
      </div>
    ),
    size,
  );
}

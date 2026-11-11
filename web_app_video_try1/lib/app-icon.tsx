import { ImageResponse } from "next/og";

/**
 * The home-screen icon: the Screening Room lamp (amber dot with a soft halo)
 * on the near-black canvas. `safeZone` shrinks the mark for "maskable" icons,
 * which Android crops into circles, squircles, etc.
 */
export function appIcon(size: number, { safeZone = false }: { safeZone?: boolean } = {}) {
  const mark = safeZone ? 0.42 : 0.56;
  const halo = Math.round(size * mark);
  const dot = Math.round(halo * 0.42);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
        }}
      >
        <div
          style={{
            width: halo,
            height: halo,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle, rgba(234,166,74,0.30) 0%, rgba(234,166,74,0.10) 55%, rgba(234,166,74,0) 72%)",
          }}
        >
          <div
            style={{
              width: dot,
              height: dot,
              borderRadius: "50%",
              background: "#eaa64a",
              boxShadow: `0 0 ${Math.round(dot * 0.6)}px ${Math.round(dot * 0.15)}px rgba(234,166,74,0.55)`,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

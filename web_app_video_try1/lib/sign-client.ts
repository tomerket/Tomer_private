/** Asks our server to sign an ImageKit URL. The server checks the viewer may see it. */
export async function signedUrl(url: string): Promise<string> {
  const res = await fetch("/api/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Signing refused (${res.status})`);
  return res.text();
}

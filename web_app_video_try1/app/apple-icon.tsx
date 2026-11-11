import { appIcon } from "@/lib/app-icon";

/** iPhone/iPad home-screen icon (Next links it automatically). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}

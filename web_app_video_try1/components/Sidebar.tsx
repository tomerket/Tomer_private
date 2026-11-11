import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { SidebarNav } from "./SidebarNav";

/**
 * Left navigation (top row on small screens). The active item needs the URL and
 * the Studio item needs the session, so both stream in behind Suspense; the
 * fallback renders the same items without either.
 */
export function Sidebar() {
  return (
    <Suspense fallback={<SidebarNav showStudio={false} live={false} />}>
      <SidebarWithViewer />
    </Suspense>
  );
}

async function SidebarWithViewer() {
  const viewer = await getViewer();
  return <SidebarNav showStudio={Boolean(viewer?.isCreator)} live />;
}

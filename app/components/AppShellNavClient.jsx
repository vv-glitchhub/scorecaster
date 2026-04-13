"use client";

import { usePathname } from "next/navigation";
import AppShellNav from "@/app/components/AppShellNav";

export default function AppShellNavClient({ lang = "en" }) {
  const pathname = usePathname() || "/";
  return <AppShellNav lang={lang} pathname={pathname} />;
}

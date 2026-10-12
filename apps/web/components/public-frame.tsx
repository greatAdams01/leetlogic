"use client";

import { usePathname } from "next/navigation";
import { LanguageProvider } from "./language-provider";
import { Header, Footer } from "./site";

export function PublicFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return <LanguageProvider>{children}</LanguageProvider>;
  return (
    <LanguageProvider>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </LanguageProvider>
  );
}

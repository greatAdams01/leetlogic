"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSelector, useLanguage } from "./language-provider";
import type { MessageKey } from "../lib/locales/messages";
import { useState } from "react";

const links = [
  ["nav.about", "/about"],
  ["nav.how", "/how-it-works"],
  ["nav.buyers", "/for-buyers"],
  ["nav.impact", "/impact"],
  ["nav.team", "/team"],
];
export function Navigation() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        {t(open ? "nav.close" : "nav.menu")}
      </button>
      <nav
        id="main-navigation"
        aria-label="Main navigation"
        className={open ? "navigation open" : "navigation"}
      >
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {t(label as MessageKey)}
          </Link>
        ))}
        <Link href="/account">{t("nav.account")}</Link>
        <LanguageSelector />
      </nav>
    </>
  );
}

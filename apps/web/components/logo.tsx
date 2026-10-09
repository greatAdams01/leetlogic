"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo({ reversed = false }: { reversed?: boolean }) {
  const pathname = usePathname();
  const wordmark = reversed
    ? "a1008"
    : ["/impact", "/contact"].includes(pathname)
      ? "d21f8"
      : "40847";
  return (
    <Link href="/" aria-label="LeetLogic home" className="logo">
      <img src={`/figma/${reversed ? "c00a9" : "cbff0"}.svg`} alt="" />
      <img src={`/figma/${wordmark}.svg`} alt="LeetLogic" />
    </Link>
  );
}

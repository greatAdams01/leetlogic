import Link from "next/link";
import styles from "./legal-document.module.css";
export function LegalDocument({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className={styles.document}>
      <p className={styles.eyebrow}>LeetLogic policies</p>
      <h1>{title}</h1>
      <p className={styles.date}>Draft for review · Updated 22 October 2026</p>
      <aside className={styles.draft}>
        These draft terms and privacy disclosures describe the current pilot and proposed launch
        arrangements. They are not yet the final production agreement. Before launch, LeetLogic must
        confirm the operator and contact details, enabled providers, retention periods and
        applicable legal requirements.
      </aside>
      <nav aria-label="Policy pages">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      {children}
    </article>
  );
}

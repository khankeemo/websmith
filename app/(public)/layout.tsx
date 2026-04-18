import type { CSSProperties, ReactNode } from "react";
import PublicSiteNav from "../../components/layout/PublicSiteNav";
import PublicFooter from "../../components/layout/PublicFooter";

export default function PublicModuleLayout({ children }: { children: ReactNode }) {
  return (
    <div style={styles.shell}>
      <PublicSiteNav />
      <main style={styles.main}>{children}</main>
      <PublicFooter />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--bg-primary)",
  },
  main: {
    flex: 1,
  },
};

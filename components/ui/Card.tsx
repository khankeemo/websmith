"use client";

export default function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      {children}
    </div>
  );
}

const styles: any = {
  card: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "20px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    border: "1px solid #eee",
    transition: "all 0.2s ease",
  },
};
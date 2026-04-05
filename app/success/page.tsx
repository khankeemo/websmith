import Link from "next/link";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function SuccessPage() {
  return (
    <div style={styles.wrapper}>
      <Card>
        <div style={styles.content}>
          <div style={styles.checkWrap}>✓</div>
          <p style={styles.eyebrow}>Lead submitted</p>
          <h1 style={styles.title}>Thank you! Our team will contact you shortly.</h1>
          <p style={styles.subtitle}>
            Your request has been captured and sent to the sales team. We&apos;ll review your selected services and follow up with next steps.
          </p>

          <div style={styles.actions}>
            <a href="mailto:sales@websmith.dev?subject=Book%20a%20discovery%20call">
              <Button size="lg">Book a Call</Button>
            </a>
            <Link href="/">
              <Button size="lg" variant="secondary">Back to Homepage</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

const styles: any = {
  wrapper: {
    maxWidth: "820px",
    margin: "0 auto",
    padding: "64px 24px",
  },
  content: {
    textAlign: "center",
    padding: "24px 8px",
  },
  checkWrap: {
    width: "72px",
    height: "72px",
    borderRadius: "999px",
    backgroundColor: "#E8F5E9",
    color: "#34C759",
    fontSize: "34px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 18px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "14px 0 12px",
    fontSize: "36px",
    fontWeight: 700,
    color: "#1C1C1E",
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "0 auto",
    maxWidth: "620px",
    color: "#6B7280",
    fontSize: "16px",
    lineHeight: 1.8,
  },
  actions: {
    marginTop: "28px",
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
};

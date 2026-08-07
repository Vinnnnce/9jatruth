import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Page Not Found</h1>
      <p style={{ color: "#71717a", marginBottom: "1.5rem" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a href="/" style={{ color: "#16a34a", textDecoration: "underline" }}>
        Back to Dashboard
      </a>
    </div>
  );
}

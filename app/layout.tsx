import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditAI — Quality & Compliance Intelligence",
  description: "AI-powered CAPA management for Veridian MedTech",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doc Chat — answers from your documents",
  description: "An AI help assistant that answers questions from your own documents and shows its sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

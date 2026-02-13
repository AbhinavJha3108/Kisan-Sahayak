import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kisaan Sahayak AI",
  description: "Fast demo chatbot for agriculture guidance"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

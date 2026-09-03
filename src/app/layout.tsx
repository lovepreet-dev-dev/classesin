import type { Metadata } from "next";
import "./globals.css";
import "./enhancements.css";

export const metadata: Metadata = {
  title: "Kinship — Learning workspace",
  description: "Course delivery and enrollment for modern teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

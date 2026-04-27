import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Saga — The AI Talent Agency for Creative Production",
  description: "Describe the project. Saga finds the team, relays outreach privately by text, turns replies into terms, and manages the booking workflow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-canvas min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpareSetu - Gujarat Refinery",
  description: "Inventory Management Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Font Awesome aur Industrial Fonts load karne ke liye */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
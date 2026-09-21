import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Verdic Nimai",
  description: "A reflective profile drawn from personality, attachment, guna, prakriti, and your Vedic chart.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={{ paddingBottom: "14rem" }}>
        {children}
        <NavBar />
      </body>
    </html>
  );
}

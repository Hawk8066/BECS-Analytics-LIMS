import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 is a native module and must not be bundled by the server compiler.
  serverExternalPackages: ["argon2"],
  experimental: {
    // Excel imports post the workbook through a server action; the 1 MB default
    // rejects real-world register files.
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;

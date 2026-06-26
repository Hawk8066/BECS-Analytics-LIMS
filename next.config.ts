import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 is a native module and must not be bundled by the server compiler.
  serverExternalPackages: ["argon2"],
};

export default nextConfig;

import { withAxiom } from "next-axiom";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // For Docker deployment
};

export default withAxiom(nextConfig);

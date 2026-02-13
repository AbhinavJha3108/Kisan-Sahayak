import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f5e7d0",
        leaf: "#294833",
        soil: "#6d4c2c",
        sky: "#9ed0ff"
      }
    }
  },
  plugins: []
};

export default config;

import path from "path";
import { build } from "../src/index";

build({
  target: "es2018",
  srcDir: path.resolve(__dirname, "src"),
  outDir: path.resolve(__dirname, "dist"),
  formats: ["cjs", "esm", "legacy"],
  declarations: true,
  tsConfig: path.resolve(__dirname, "tsconfig.json"),
  decoratorsMetadata: true,
  esbuildOptions: {
    loader: { ".data": "base64", ".custom": "json" },
  },
  extMapping: {
    ".custom": "%FORMAT%",
  },
  pathAliases: {
    "@Root/*": "./*",
  },
});

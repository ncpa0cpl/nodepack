import path from "path";
import { build } from "../src/index";

build({
  target: "es2018",
  srcDir: path.resolve(__dirname, "../src"),
  outDir: path.resolve(__dirname, "../dist"),
  formats: ["cjs", "esm", "legacy"],
  tsConfig: path.resolve(__dirname, "../tsconfig.json"),
  declarations: true,
});

import { execSync } from "child_process";
import pkg from "../package.json" assert { type: "json" };

function main() {
  const packages = Object.keys(pkg.dependencies).concat(
    Object.keys(pkg.devDependencies)
  );

  for (const pkgName of packages) {
    if (pkgName.startsWith("ncpa0cpl")) {
      continue;
    }

    try {
      execSync(`yarn upgrade --latest ${pkgName}`, { stdio: "inherit" });
    } catch (e) {
      console.warn("Failed to upgrade dependency:", pkgName);
    }
  }
}

main();

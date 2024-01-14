import chokidar from "chokidar";
import { walk } from "node-os-walk";
import path from "path";
import type { BuildConfig } from "./build-config-type";
import { Builder } from "./builder";
import { DeclarationBuilder } from "./declaration-builder";
import { DeclarationPathRewriter } from "./declaration-path-rewriter";
import { ConfigHelper } from "./utilities/config-helper";
import { ExcludeFacade } from "./utilities/exclude-facade";
import { ExtensionMapper } from "./utilities/extension-mapper";
import { FormatsFacade } from "./utilities/formats-facade";
import { CacheMap } from "./utilities/info-cache";
import { isParsable } from "./utilities/is-parsable";
import { IsomorphicImportsMapper } from "./utilities/isomorphic-imports-mapper";
import { PathAliasResolver } from "./utilities/path-alias-resolver";
import { getTsWorkerPool } from "./workers";

export type ProgramContext = {
  config: ConfigHelper;
  pathAliases: PathAliasResolver;
  excludes: ExcludeFacade;
  formats: FormatsFacade;
  extMap: ExtensionMapper;
  tsProgram: ReturnType<typeof getTsWorkerPool>;
  isomorphicImports: IsomorphicImportsMapper;
  vendorsDir: string;
};

const noop = () => {};

export class Program {
  context: ProgramContext;

  constructor(config: BuildConfig) {
    this.context = {
      config: new ConfigHelper(config),
      pathAliases: new PathAliasResolver(config.pathAliases),
      excludes: new ExcludeFacade(config.exclude ?? []),
      formats: new FormatsFacade(config.formats ?? []),
      extMap: new ExtensionMapper(config.extMapping ?? {}),
      tsProgram: getTsWorkerPool(config.tsConfig),
      isomorphicImports: new IsomorphicImportsMapper(
        config.isomorphicImports ?? {},
        config.srcDir
      ),
      vendorsDir: "_vendors",
    };
  }

  private shouldCompile(filePath: string) {
    return (
      this.context.excludes.isNotExcluded(filePath) &&
      (isParsable(
        this.context.config.get("parsableExtensions", []),
        filePath
      ) ||
        this.context.extMap.hasMapping(path.extname(filePath))) &&
      !this.context.isomorphicImports.isIsomorphicTarget(filePath)
    );
  }

  private async bundle(builder: Builder) {
    if (typeof this.context.config.get("entrypoint") !== "string") {
      throw new Error(
        "`entrypoint` must be provided when bundling is enabled."
      );
    }

    const entrypointPath = path.resolve(
      this.context.config.get("srcDir"),
      this.context.config.get("entrypoint")!
    );

    if (this.context.formats.isCjs) {
      await builder.bundle(entrypointPath, "cjs");
    }

    if (this.context.formats.isEsm) {
      await builder.bundle(entrypointPath, "esm");
    }

    if (this.context.formats.isLegacy) {
      await builder.bundle(entrypointPath, "legacy");
    }

    const vendors = this.context.config.get("compileVendors");
    if (Array.isArray(vendors)) {
      builder.vendorBuilder.addVendors(vendors);
    }

    await builder.vendorBuilder.flush();
  }

  private async build(builder: Builder) {
    const filesForCompilation: string[] = [];

    for await (const [root, _, files] of walk(
      this.context.config.get("srcDir")
    )) {
      for (const file of files) {
        const filePath = path.join(root, file.name);

        if (this.shouldCompile(filePath)) {
          filesForCompilation.push(filePath);
        }
      }
    }

    return this.buildFiles(builder, filesForCompilation);
  }

  private async buildFiles(builder: Builder, files: string[]) {
    if (this.context.formats.isCjs) {
      await Promise.all(files.map((file) => builder.build(file, "cjs")));
    }

    if (this.context.formats.isEsm) {
      await Promise.all(files.map((file) => builder.build(file, "esm")));
    }

    if (this.context.formats.isLegacy) {
      await Promise.all(files.map((file) => builder.build(file, "legacy")));
    }

    const vendors = this.context.config.get("compileVendors");
    if (Array.isArray(vendors)) {
      builder.vendorBuilder.addVendors(vendors);
    }

    await builder.vendorBuilder.flush();
  }

  async transpileSource() {
    const builder = new Builder(
      this.context,
      this.context.config.get("srcDir"),
      this.context.config.get("outDir")
    );

    if (this.context.config.get("bundle")) {
      await this.bundle(builder);
    } else {
      await this.build(builder);
    }
  }

  async emitDeclarations() {
    const declarationBuilder = new DeclarationBuilder(
      this.context,
      this.context.config.get("srcDir"),
      this.context.config.get("outDir")
    );

    await declarationBuilder.build();

    if (this.context.config.get("pathAliases")) {
      const declarationPathRewriter = new DeclarationPathRewriter(
        this.context,
        declarationBuilder.getOutDir()
      );

      await declarationPathRewriter.rewrite();
    }
  }

  async watchSource() {
    CacheMap.disableCache();

    const builder = new Builder(
      this.context,
      this.context.config.get("srcDir"),
      this.context.config.get("outDir")
    );

    const onBuildComplete = this.context.config.get("onBuildComplete") as
      | (() => void | (() => any))
      | undefined;
    const bundle = this.context.config.get("bundle");
    const abortSignal = this.context.config.get("watchAbortSignal");

    console.log("Initial build...");
    if (this.context.config.get("bundle")) {
      await this.bundle(builder).catch((error) => {
        console.error(error);
      });
    } else {
      await this.build(builder).catch((error) => {
        console.error(error);
      });
    }

    let cleanup = noop;

    try {
      cleanup = onBuildComplete?.() ?? noop;
    } catch {
      //
    }

    console.log("Watching for changes...");
    const watcher = chokidar
      .watch(this.context.config.get("srcDir"), { ignoreInitial: true })
      .on("all", (event, path) => {
        if (event !== "addDir" && this.shouldCompile(path)) {
          try {
            cleanup();
          } catch {
            //
          }

          if (bundle) {
            this.bundle(builder).catch((error) => {
              console.error(error);
            });
          } else {
            this.buildFiles(builder, [path]).catch((error) => {
              console.error(error);
            });
          }

          try {
            cleanup = onBuildComplete?.() ?? noop;
          } catch {
            //
          }
        }
      });

    return new Promise<void>((resolve) => {
      if (abortSignal) {
        abortSignal.onabort = () => {
          watcher.close();
          resolve();
        };
      }
    });
  }

  close() {
    this.context.tsProgram.close();
  }
}

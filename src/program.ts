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
  builder;

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
        config.srcDir,
      ),
      vendorsDir: "_vendors",
    };

    this.builder = new Builder(
      this.context,
      this.context.config.get("srcDir"),
      this.context.config.get("outDir"),
    );
  }

  private shouldCompile(filePath: string) {
    const isNotExcluded = this.context.excludes.isNotExcluded(filePath);
    const extMatch = isParsable(
      this.context.config.get("parsableExtensions", []),
      filePath,
    );
    const isMappedExt = this.context.extMap.hasMapping(path.extname(filePath));

    return (
      isNotExcluded && (extMatch || isMappedExt)
    );
  }

  private isForFormat(filePath: string, format: "cjs" | "esm" | "legacy") {
    const isIsomorphicTarget = this.context.isomorphicImports
      .isIsomorphicTarget(filePath);

    if (isIsomorphicTarget) {
      const targetFmts = this.context.isomorphicImports.targetFormats(filePath);
      const include = targetFmts.includes(format);

      return include;
    }

    if (this.context.isomorphicImports.isIsomorphic(filePath)) {
      return false;
    }

    return true;
  }

  private async bundle(builder: Builder) {
    if (typeof this.context.config.get("entrypoint") !== "string") {
      throw new Error(
        "`entrypoint` must be provided when bundling is enabled.",
      );
    }

    const entrypointPath = path.resolve(
      this.context.config.get("srcDir"),
      this.context.config.get("entrypoint")!,
    );

    const vendors = this.context.config.get("compileVendors");
    if (Array.isArray(vendors) && vendors.length > 0) {
      builder.vendorBuilder.addVendors(vendors);
      await builder.vendorBuilder.flush();
    }

    if (this.context.formats.isCjs) {
      return [await builder.bundle(entrypointPath, "cjs")];
    }

    if (this.context.formats.isEsm) {
      return [await builder.bundle(entrypointPath, "esm")];
    }

    if (this.context.formats.isLegacy) {
      return [await builder.bundle(entrypointPath, "legacy")];
    }

    return [];
  }

  private async build(builder: Builder) {
    const filesForCompilation: string[] = [];

    for await (
      const [root, _, files] of walk(
        this.context.config.get("srcDir"),
      )
    ) {
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
    const vendors = this.context.config.get("compileVendors");
    if (Array.isArray(vendors) && vendors.length > 0) {
      builder.vendorBuilder.addVendors(vendors);
      await builder.vendorBuilder.flush();
    }

    const ops: Array<Promise<string[]>> = [];

    if (this.context.formats.isCjs) {
      ops.push(Promise.all(
        files
          .filter(f => this.isForFormat(f, "cjs"))
          .map((file) => builder.build(file, "cjs")),
      ));
    }

    if (this.context.formats.isEsm) {
      ops.push(Promise.all(
        files
          .filter(f => this.isForFormat(f, "esm"))
          .map((file) => builder.build(file, "esm")),
      ));
    }

    if (this.context.formats.isLegacy) {
      ops.push(Promise.all(
        files
          .filter(f => this.isForFormat(f, "legacy"))
          .map((file) => builder.build(file, "legacy")),
      ));
    }

    return Promise.all(ops).then(l => l.flat());
  }

  async transpileSource() {
    if (this.context.config.get("bundle")) {
      return await this.bundle(this.builder);
    } else {
      return await this.build(this.builder);
    }
  }

  async emitDeclarations() {
    const declarationBuilder = new DeclarationBuilder(
      this.context,
      this.context.config.get("srcDir"),
      this.context.config.get("outDir"),
    );

    await declarationBuilder.build();

    if (this.context.config.get("pathAliases")) {
      const declarationPathRewriter = new DeclarationPathRewriter(
        this.context,
        declarationBuilder.getOutDir(),
      );

      await declarationPathRewriter.rewrite();
    }
  }

  async watchSource() {
    CacheMap.disableCache();

    const onBuildComplete = this.context.config.get("onBuildComplete") as
      | ((
        result: { outputs: string[] },
      ) => void | (() => any) | Promise<void | (() => any)>)
      | undefined;
    const bundle = this.context.config.get("bundle");
    const abortSignal = this.context.config.get("watchAbortSignal");

    console.log("Initial build...");

    let cleanup: () => any = noop;

    try {
      let outputs: string[];
      if (this.context.config.get("bundle")) {
        outputs = await this.bundle(this.builder).catch((error) => {
          console.error(error);
          return [];
        });
      } else {
        outputs = await this.build(this.builder).catch((error) => {
          console.error(error);
          return [];
        });
      }

      try {
        cleanup = await onBuildComplete?.({ outputs }) ?? noop;
      } catch (err) {
        console.error(err);
      }
    } catch (err) {
      console.error(err);
    }

    console.log("Watching for changes...");
    const watcher = chokidar
      .watch(this.context.config.get("srcDir"), { ignoreInitial: true })
      .on("all", async (event, fpath) => {
        try {
          if (event !== "addDir" && this.shouldCompile(fpath)) {
            console.log(
              `Detected change in ${path.basename(fpath)}, rebuilding...`,
            );

            try {
              await cleanup();
            } catch (e) {
              console.error(e);
            }

            let outputs: string[];
            if (bundle) {
              outputs = await this.bundle(this.builder).catch((error) => {
                console.error(error);
                return [];
              });
            } else {
              outputs = await this.buildFiles(this.builder, [fpath]).catch(
                (error) => {
                  console.error(error);
                  return [];
                },
              );
            }

            try {
              cleanup = await onBuildComplete?.({ outputs }) ?? noop;
            } catch (e) {
              console.error(e);
            }
          }
        } catch (err) {
          console.error(err);
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

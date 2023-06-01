import type { BuildContext } from "esbuild";
import fs from "fs";
import { walk } from "node-os-walk";
import path from "path";
import type { BuildConfig } from "./build-config-type";
import { Builder } from "./builder";
import { DeclarationBuilder } from "./declaration-builder";
import { DeclarationPathRewriter } from "./declaration-path-rewriter";
import { ExcludeFacade } from "./utilities/exclude-facade";
import { ExtensionMapper } from "./utilities/extension-mapper";
import { FormatsFacade } from "./utilities/formats-facade";
import { CacheMap } from "./utilities/info-cache";
import { isDirectory } from "./utilities/is-directory";
import { isParsable } from "./utilities/is-parsable";
import { fileExists } from "./utilities/is-real-path";
import { IsomorphicImportsMapper } from "./utilities/isomorphic-imports-mapper";
import { PathAliasResolver } from "./utilities/path-alias-resolver";
import { getTsWorkerPool } from "./workers";

export type ProgramContext = {
  buildConfig: BuildConfig;
  pathAliases: PathAliasResolver;
  excludes: ExcludeFacade;
  formats: FormatsFacade;
  extMap: ExtensionMapper;
  tsProgram: ReturnType<typeof getTsWorkerPool>;
  isomorphicImports: IsomorphicImportsMapper;
  vendorsDir: string;
};

export class Program {
  context: ProgramContext;

  constructor(config: BuildConfig) {
    this.context = {
      buildConfig: config,
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

  async transpileSource() {
    const builder = new Builder(
      this.context,
      this.context.buildConfig.srcDir,
      this.context.buildConfig.outDir
    );

    const filesForCompilation: string[] = [];
    for await (const [root, _, files] of walk(
      this.context.buildConfig.srcDir
    )) {
      for (const file of files) {
        const filePath = path.join(root, file.name);

        if (
          this.context.excludes.isNotExcluded(filePath) &&
          (isParsable(filePath) ||
            this.context.extMap.hasMapping(path.extname(filePath))) &&
          !this.context.isomorphicImports.isIsomorphicTarget(filePath)
        ) {
          filesForCompilation.push(filePath);
        }
      }
    }

    if (this.context.buildConfig.bundle) {
      if (typeof this.context.buildConfig.entrypoint !== "string") {
        throw new Error(
          "`entrypoint` must be provided when bundling is enabled."
        );
      }

      const entrypointPath = path.resolve(
        this.context.buildConfig.srcDir,
        this.context.buildConfig.entrypoint
      );

      if (this.context.formats.isCjs)
        await Promise.all([
          builder.bundle(entrypointPath, "cjs"),
          builder.buildVendors("cjs"),
        ]);

      if (this.context.formats.isEsm)
        await Promise.all([
          builder.bundle(entrypointPath, "esm"),
          builder.buildVendors("esm"),
        ]);

      if (this.context.formats.isLegacy)
        await Promise.all([
          builder.bundle(entrypointPath, "legacy"),
          builder.buildVendors("legacy"),
        ]);
    } else {
      if (this.context.formats.isCjs)
        await Promise.all([
          ...filesForCompilation.map((file) => builder.build(file, "cjs")),
          builder.buildVendors("cjs"),
        ]);

      if (this.context.formats.isEsm)
        await Promise.all([
          ...filesForCompilation.map((file) => builder.build(file, "esm")),
          builder.buildVendors("esm"),
        ]);

      if (this.context.formats.isLegacy)
        await Promise.all([
          ...filesForCompilation.map((file) => builder.build(file, "legacy")),
          builder.buildVendors("legacy"),
        ]);
    }
  }

  async emitDeclarations() {
    const declarationBuilder = new DeclarationBuilder(
      this.context,
      this.context.buildConfig.srcDir,
      this.context.buildConfig.outDir
    );

    await declarationBuilder.build();

    if (this.context.buildConfig.pathAliases) {
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
      this.context.buildConfig.srcDir,
      this.context.buildConfig.outDir
    );

    const watched = new Map<string, BuildContext[]>();

    const startWatchingSourceFile = async (file: string) => {
      if (await fileExists(file)) {
        const awaiters: Promise<any>[] = [];
        const ctxs: BuildContext[] = [];

        if (this.context.formats.isCjs) {
          const { awaiter, buildContext } = await builder.watch(file, "cjs");
          awaiters.push(awaiter);
          ctxs.push(buildContext);
        }

        if (this.context.formats.isEsm) {
          const { awaiter, buildContext } = await builder.watch(file, "esm");
          awaiters.push(awaiter);
          ctxs.push(buildContext);
        }

        if (this.context.formats.isLegacy) {
          const { awaiter, buildContext } = await builder.watch(file, "legacy");
          awaiters.push(awaiter);
          ctxs.push(buildContext);
        }

        watched.set(file, ctxs);

        return Promise.all(awaiters);
      }

      return Promise.resolve([]);
    };

    const startWatchingDirectory = (dir: string) => {
      fs.watch(dir, {}, async (eventType, filename) => {
        if (eventType === "rename" && filename != null) {
          console.log("file rename detected", filename);

          const filepath = path.resolve(dir, filename);

          const previousCtxs = watched.get(filepath);
          watched.delete(filepath);
          if (previousCtxs) {
            for (const ctx of previousCtxs) {
              await ctx.cancel();
              await ctx.dispose();
            }
          }

          onFileRename(filepath);
        }
      });
    };

    const onFileRename = async (filename: string) => {
      if (await isDirectory(filename)) {
        for await (const [root, dirs, files] of walk(filename)) {
          for (const file of files) {
            const filePath = path.join(root, file.name);

            if (
              this.context.excludes.isNotExcluded(filePath) &&
              (isParsable(filePath) ||
                this.context.extMap.hasMapping(path.extname(filePath))) &&
              !this.context.isomorphicImports.isIsomorphicTarget(filePath)
            ) {
              filesForCompilation.push(filePath);
            }
          }

          for (const dir of dirs) {
            const dirPath = path.join(root, dir.name);
            startWatchingDirectory(dirPath);
          }
        }
      } else {
        startWatchingSourceFile(filename);
      }
    };

    startWatchingDirectory(this.context.buildConfig.srcDir);

    await Promise.all([
      this.context.formats.isCjs
        ? builder.buildVendors("cjs")
        : Promise.resolve(),
      this.context.formats.isEsm
        ? builder.buildVendors("esm")
        : Promise.resolve(),
      this.context.formats.isLegacy
        ? builder.buildVendors("legacy")
        : Promise.resolve(),
    ]);

    const filesForCompilation: string[] = [];
    for await (const [root, dirs, files] of walk(
      this.context.buildConfig.srcDir
    )) {
      for (const file of files) {
        const filePath = path.join(root, file.name);

        if (
          this.context.excludes.isNotExcluded(filePath) &&
          (isParsable(filePath) ||
            this.context.extMap.hasMapping(path.extname(filePath)))
        ) {
          filesForCompilation.push(filePath);
        }
      }

      for (const dir of dirs) {
        const dirPath = path.join(root, dir.name);
        startWatchingDirectory(dirPath);
      }
    }

    await Promise.all(filesForCompilation.flatMap(startWatchingSourceFile));
  }

  close() {
    this.context.tsProgram.close();
  }
}

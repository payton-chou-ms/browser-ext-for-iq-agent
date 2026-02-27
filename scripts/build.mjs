import esbuild from "esbuild";

const watchMode = process.argv.includes("--watch");

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  legalComments: "none",
  treeShaking: true,
};

const proxyBuild = {
  ...common,
  entryPoints: ["proxy.ts"],
  outfile: "dist/proxy.js",
  minify: false,
  banner: { js: "#!/usr/bin/env node" },
};

const achievementBuild = {
  bundle: false,
  platform: "browser",
  format: "iife",
  target: "es2020",
  sourcemap: true,
  legalComments: "none",
  entryPoints: ["achievement-engine.ts"],
  outfile: "achievement-engine.js",
  minify: false,
};

async function run() {
  if (watchMode) {
    const ctx = await esbuild.context(proxyBuild);
    const achievementCtx = await esbuild.context(achievementBuild);
    await ctx.watch();
    await achievementCtx.watch();
    console.log("[build] watching proxy.ts → dist/proxy.js");
    console.log("[build] watching achievement-engine.ts → achievement-engine.js");
    return;
  }

  await Promise.all([esbuild.build(proxyBuild), esbuild.build(achievementBuild)]);
  console.log("[build] built dist/proxy.js");
  console.log("[build] built achievement-engine.js");
}

run().catch((err) => {
  console.error("[build] failed", err);
  process.exit(1);
});

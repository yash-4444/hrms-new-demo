/**
 * Post-build fix for the static export's segment-prefetch files on Windows.
 *
 * The client router requests per-segment prefetch data as one flat file name,
 *   /dashboard/__next.!KGFwcCk.dashboard.__PAGE__.txt
 * but `next build` on Windows writes it with back-slash separated segment
 * paths, which become nested folders:
 *   out/dashboard/__next.!KGFwcCk/dashboard/__PAGE__.txt
 * Every prefetch then 404s (navigation still works through the fallback, but
 * the console fills with thousands of errors during a demo). Next.js has no
 * config switch for this, so after the build we copy every nested file to the
 * flat name the client asks for. On Linux/macOS builds there are no nested
 * folders and this script does nothing.
 *
 * Runs automatically as the `postbuild` npm script.
 */
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = join(process.cwd(), "out");
let copied = 0;

/** All files below `dir`, as paths relative to `dir`. */
function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? filesUnder(full).map((f) => join(name, f))
      : [name];
  });
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      // out/<route>/__next.X/a/b.txt  ->  out/<route>/__next.X.a.b.txt
      for (const rel of filesUnder(full)) {
        const flat = join(dir, `${name}.${rel.split(sep).join(".")}`);
        if (!existsSync(flat)) {
          copyFileSync(join(full, rel), flat);
          copied += 1;
        }
      }
    } else {
      walk(full);
    }
  }
}

if (existsSync(OUT)) {
  walk(OUT);
  console.log(`flatten-export-segments: ${copied} prefetch file(s) written in ${relative(process.cwd(), OUT)}/`);
}

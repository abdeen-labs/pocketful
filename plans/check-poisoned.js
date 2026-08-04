const fs = require("fs");
const path = require("path");

const REPO = "/Users/cuz/GitHub/pocketful";
const PROJECTS = ["server", "app", "mcp"];

// name -> Set of poisoned versions
const poisoned = new Map();
for (const line of fs.readFileSync(process.argv[2], "utf8").trim().split("\n")) {
  const [name, versions] = line.split("\t");
  poisoned.set(name, new Set(versions.split(", ").map((v) => v.trim())));
}
console.log(`Poisoned list: ${poisoned.size} package names`);

// 1) Lockfile scan: extract every resolved "name@version" from bun.lock
for (const project of PROJECTS) {
  const lockPath = path.join(REPO, project, "bun.lock");
  if (!fs.existsSync(lockPath)) { console.log(`\n${project}/bun.lock: MISSING`); continue; }
  const text = fs.readFileSync(lockPath, "utf8");
  // resolution entries look like: ["name@1.2.3", ...] (scoped or not)
  const re = /\["((?:@[^\/"@]+\/)?[^"@]+)@(\d[^"]*)"/g;
  const found = new Map();
  let m;
  while ((m = re.exec(text))) {
    if (!found.has(m[1])) found.set(m[1], new Set());
    found.get(m[1]).add(m[2]);
  }
  console.log(`\n${project}/bun.lock: ${found.size} unique packages resolved`);
  let hits = 0;
  for (const [name, versions] of found) {
    if (!poisoned.has(name)) continue;
    for (const v of versions) {
      const bad = poisoned.get(name).has(v);
      console.log(`  ${bad ? "!!! POISONED" : "  name-match, SAFE version"}: ${name}@${v}`);
      if (bad) hits++;
    }
  }
  if (!hits) console.log("  => no poisoned name@version in lockfile");
}

// 2) On-disk scan: walk every package.json under node_modules (nested included)
for (const project of PROJECTS) {
  const nm = path.join(REPO, project, "node_modules");
  if (!fs.existsSync(nm)) { console.log(`\n${project}/node_modules: MISSING (never installed)`); continue; }
  let scanned = 0, hits = 0, nameMatches = 0;
  const stack = [nm];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.isSymbolicLink()) {
        if (e.name === "node_modules" || e.name.startsWith("@") || dir.endsWith("node_modules") || path.basename(dir).startsWith("@")) {
          stack.push(full);
        }
      } else if (e.name === "package.json" && (path.basename(path.dirname(path.dirname(full))) === "node_modules" || path.basename(path.dirname(path.dirname(path.dirname(full)))) === "node_modules")) {
        try {
          const pkg = JSON.parse(fs.readFileSync(full, "utf8"));
          if (!pkg.name || !pkg.version) continue;
          scanned++;
          if (poisoned.has(pkg.name)) {
            nameMatches++;
            const bad = poisoned.get(pkg.name).has(pkg.version);
            console.log(`  ${bad ? "!!! POISONED ON DISK" : "  name-match on disk, SAFE version"}: ${pkg.name}@${pkg.version} (${project})`);
            if (bad) hits++;
          }
        } catch {}
      }
    }
  }
  console.log(`\n${project}/node_modules: scanned ${scanned} installed packages, ${nameMatches} name matches, ${hits} poisoned`);
}

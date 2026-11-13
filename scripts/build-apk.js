const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const android = path.join(root, "android");
const pkg = require(path.join(root, "package.json"));
const version = pkg.version;
const parts = String(version).split(".").map((part) => parseInt(part, 10) || 0);
const versionCode = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);

const gradlePath = path.join(android, "app", "build.gradle");
const gradle = fs.readFileSync(gradlePath, "utf8")
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`);
fs.writeFileSync(gradlePath, gradle);

const configPath = path.join(root, "www", "sitrus.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.launcherVersion = version;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

const sync = spawnSync("npx", ["cap", "sync", "android"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: true,
});
if (sync.status !== 0) process.exit(sync.status || 1);

const sdk = process.env.ANDROID_HOME || "C:\\Android\\sdk";
process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;
if (!process.env.JAVA_HOME) {
  const java = spawnSync("java", ["-XshowSettings:properties", "-version"], { encoding: "utf8" });
  const match = `${java.stdout || ""}\n${java.stderr || ""}`.match(/java\.home = (.+)/);
  if (match) process.env.JAVA_HOME = match[1].trim();
}

const result = spawnSync("gradlew.bat", ["assembleDebug"], {
  cwd: android,
  stdio: "inherit",
  env: process.env,
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const built = path.join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const output = path.join(dist, `Sitrus-Launcher-Mobile-${version}.apk`);
fs.copyFileSync(built, output);
console.log(output);

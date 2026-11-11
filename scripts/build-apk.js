const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const android = path.join(root, "android");
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
const version = require(path.join(root, "package.json")).version;
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const output = path.join(dist, `Sitrus-Launcher-Mobile-${version}.apk`);
fs.copyFileSync(built, output);
console.log(output);

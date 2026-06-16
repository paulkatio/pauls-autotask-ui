// Wird über das npm-"prepare"-Skript bei `npm install` ausgeführt: verdrahtet die
// versionierten Git-Hooks unter .githooks/ (Pre-Commit-Lint-Gate). Bewusst
// fehlertolerant – z. B. bei Tarball-Installs ohne Git-Repo passiert einfach nichts.
import { execSync } from "node:child_process";

try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
  // Kein Git-Repo / git nicht verfügbar -> Hooks sind optional.
}

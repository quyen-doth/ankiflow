#!/usr/bin/env node
/**
 * Computes the next release version from Conventional Commits between the
 * release base (`origin/main`) and the current branch, then applies it to
 * `package.json` and `CHANGELOG.md`.
 *
 * Bump rules (documented in docs/CONTRIBUTING.md):
 *   - `feat:` / `feat!:` / `BREAKING CHANGE:`  -> MINOR while 0.x, MAJOR from 1.0.0
 *   - any other Conventional Commit type       -> PATCH
 *
 * The script is idempotent: if the working branch already carries a version
 * ahead of the base branch, the release is considered prepared and no second
 * bump is applied.
 *
 * Usage:
 *   node scripts/prepare-release.mjs [--base origin/main] [--dry-run]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const REPO_URL = 'https://github.com/quyen-doth/ankiflow';
const CHANGELOG_PATH = 'CHANGELOG.md';
const PACKAGE_PATH = 'package.json';
const LOCKFILE_PATH = 'package-lock.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseRef = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/main';

function git(...gitArgs) {
    return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
}

function parseVersion(value) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) {
        throw new Error(`Unsupported version format: ${value}`);
    }
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function formatVersion({ major, minor, patch }) {
    return `${major}.${minor}.${patch}`;
}

function compareVersions(a, b) {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** Reads every non-merge commit subject and body in `base..HEAD`. */
function readCommits() {
    const raw = git('log', '--no-merges', '--format=%s%x00%b%x1e', `${baseRef}..HEAD`);
    return raw
        .split('\x1e')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [subject, body = ''] = entry.split('\x00');
            return { subject: subject.trim(), body: body.trim() };
        });
}

function decideBump(commits, current) {
    const breaking = commits.some(
        (c) => /^[a-z]+(\([a-z0-9-]+\))?!:/.test(c.subject) || /BREAKING CHANGE/.test(c.body),
    );
    const feature = commits.some((c) => /^feat(\([a-z0-9-]+\))?!?:/.test(c.subject));

    if (breaking) {
        // While 0.x the public contract is not yet stable (SemVer §4), so a
        // breaking change is released as MINOR and called out in the changelog.
        return current.major >= 1 ? 'major' : 'minor';
    }
    return feature ? 'minor' : 'patch';
}

function applyBump(current, bump) {
    if (bump === 'major') return { major: current.major + 1, minor: 0, patch: 0 };
    if (bump === 'minor') return { major: current.major, minor: current.minor + 1, patch: 0 };
    return { major: current.major, minor: current.minor, patch: current.patch + 1 };
}

function tokyoDate() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

/**
 * Promotes the `[Unreleased]` section into a dated release section and opens a
 * fresh empty `[Unreleased]`. Hand-written entries are preserved as-is; only
 * the headings and the comparison links are rewritten.
 */
function updateChangelog(nextVersion, previousVersion, date) {
    const original = readFileSync(CHANGELOG_PATH, 'utf8');
    const marker = '## [Unreleased]';
    const markerIndex = original.indexOf(marker);
    if (markerIndex === -1) {
        throw new Error(`"${marker}" heading not found in ${CHANGELOG_PATH}`);
    }

    const afterMarker = original.slice(markerIndex + marker.length);
    const nextHeadingIndex = afterMarker.search(/\n## /);
    const entries = (nextHeadingIndex === -1 ? afterMarker : afterMarker.slice(0, nextHeadingIndex)).trim();

    const promoted = `${marker}\n\n## [${nextVersion}] - ${date}\n\n${entries}\n`;
    let updated = original.slice(0, markerIndex) + promoted + (nextHeadingIndex === -1 ? '' : afterMarker.slice(nextHeadingIndex));

    updated = updated.replace(
        /^\[Unreleased\]:.*$/m,
        `[Unreleased]: ${REPO_URL}/compare/v${nextVersion}...develop\n[${nextVersion}]: ${REPO_URL}/compare/v${previousVersion}...v${nextVersion}`,
    );

    return { content: updated, hasEntries: entries.length > 0 };
}

function emitOutput(key, value) {
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
}

function main() {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
    const currentVersion = parseVersion(pkg.version);

    let baseVersion;
    try {
        baseVersion = parseVersion(JSON.parse(git('show', `${baseRef}:${PACKAGE_PATH}`)).version);
    } catch {
        throw new Error(`Unable to read ${PACKAGE_PATH} from ${baseRef}`);
    }

    if (compareVersions(currentVersion, baseVersion) > 0) {
        console.log(`Release v${pkg.version} is already prepared on this branch. Nothing to bump.`);
        emitOutput('version', pkg.version);
        emitOutput('changed', 'false');
        return;
    }

    const commits = readCommits();
    if (commits.length === 0) {
        console.log(`No commits between ${baseRef} and HEAD. Nothing to release.`);
        emitOutput('version', '');
        emitOutput('changed', 'false');
        return;
    }

    const bump = decideBump(commits, currentVersion);
    const nextVersion = formatVersion(applyBump(currentVersion, bump));
    const date = tokyoDate();
    const { content, hasEntries } = updateChangelog(nextVersion, pkg.version, date);

    console.log(`${commits.length} commit(s) since ${baseRef} -> ${bump} bump`);
    console.log(`${pkg.version} -> ${nextVersion} (${date})`);
    if (!hasEntries) {
        console.log('::warning::CHANGELOG の [Unreleased] が空である。リリース内容を手動で追記すること。');
    }

    if (dryRun) {
        console.log('--dry-run: no files written.');
    } else {
        pkg.version = nextVersion;
        writeFileSync(PACKAGE_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
        writeFileSync(CHANGELOG_PATH, content);
        // The lockfile mirrors the manifest version in two places; keeping them
        // in sync avoids a spurious diff on the next `npm install`.
        const lock = JSON.parse(readFileSync(LOCKFILE_PATH, 'utf8'));
        lock.version = nextVersion;
        if (lock.packages?.['']) {
            lock.packages[''].version = nextVersion;
        }
        writeFileSync(LOCKFILE_PATH, `${JSON.stringify(lock, null, 2)}\n`);
    }

    emitOutput('version', nextVersion);
    emitOutput('changed', 'true');
}

main();

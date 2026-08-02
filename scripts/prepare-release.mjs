#!/usr/bin/env node
/**
 * Computes the next release version from Conventional Commits between the
 * release base (`origin/main`) and the current branch, then applies it to
 * `package.json`, `package-lock.json` and `CHANGELOG.md`.
 *
 * Bump rules (documented in docs/CONTRIBUTING.md):
 *   - `feat:` / `feat!:` / `BREAKING CHANGE:`  -> MINOR while 0.x, MAJOR from 1.0.0
 *   - any other Conventional Commit type       -> PATCH
 *
 * The script is re-entrant, not merely idempotent. A release PR may stay open
 * while further commits land on `develop`, so every run first UNDOES the
 * previous preparation (folding the prepared section back into `[Unreleased]`),
 * then recomputes the version from the full commit range and prepares again.
 * The version is always anchored on the base branch, never on the possibly
 * already-bumped working branch.
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

const UNRELEASED_HEADING = '## [Unreleased]';
/** Commits produced by this script itself must not influence the next bump. */
const PREPARATION_SUBJECT = /^chore: リリース v\d+\.\d+\.\d+ の準備$/;
/** Canonical order of Keep a Changelog categories. */
const CATEGORY_ORDER = [
    '### 破壊的変更',
    '### 追加',
    '### 変更',
    '### 非推奨',
    '### 削除',
    '### 修正',
    '### セキュリティ',
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseRef = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/main';

function git(...gitArgs) {
    return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
}

/** Same as `git`, but keeps expected failures out of the CI log. */
function gitQuiet(...gitArgs) {
    return execFileSync('git', gitArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
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

/** Reads every non-merge commit in `base..HEAD`, excluding this script's own. */
function readCommits() {
    const raw = git('log', '--no-merges', '--format=%s%x00%b%x1e', `${baseRef}..HEAD`);
    return raw
        .split('\x1e')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [subject, body = ''] = entry.split('\x00');
            return { subject: subject.trim(), body: body.trim() };
        })
        .filter((commit) => !PREPARATION_SUBJECT.test(commit.subject));
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

// --- CHANGELOG parsing -----------------------------------------------------

/** Splits the file into leading prose, the section list and the link block. */
function splitChangelog(text) {
    const lines = text.split('\n');

    let linkStart = lines.length;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (line.trim() === '') continue;
        if (/^\[[^\]]+\]:\s/.test(line)) {
            linkStart = i;
            continue;
        }
        break;
    }
    const links = lines.slice(linkStart).filter((line) => /^\[[^\]]+\]:\s/.test(line));
    const body = lines.slice(0, linkStart);

    const headingIndex = body.findIndex((line) => line.startsWith('## '));
    if (headingIndex === -1 || body[headingIndex] !== UNRELEASED_HEADING) {
        throw new Error(`"${UNRELEASED_HEADING}" must be the first section of ${CHANGELOG_PATH}`);
    }

    const head = body.slice(0, headingIndex).join('\n').trimEnd();
    const sections = [];
    let currentTitle = null;
    let buffer = [];

    const flush = () => {
        if (currentTitle !== null) {
            sections.push({ title: currentTitle, body: buffer.join('\n').trim() });
        }
    };

    for (const line of body.slice(headingIndex)) {
        if (line.startsWith('## ')) {
            flush();
            currentTitle = line;
            buffer = [];
        } else {
            buffer.push(line);
        }
    }
    flush();

    const unreleased = sections.shift();
    return { head, unreleased: unreleased.body, sections, links };
}

/** Reads a `## [x.y.z] - date` heading; returns null for non-version sections. */
function readVersionHeading(title) {
    const match = /^## \[(\d+\.\d+\.\d+)\](?:\s+-\s+(\S+))?/.exec(title);
    return match ? { version: match[1], date: match[2] ?? null } : null;
}

function parseEntries(text) {
    const prose = [];
    const groups = new Map();
    let current = null;

    for (const line of text.split('\n')) {
        if (line.startsWith('### ')) {
            current = line.trim();
            if (!groups.has(current)) groups.set(current, []);
            continue;
        }
        if (line.trim() === '') continue;
        if (current) groups.get(current).push(line);
        else prose.push(line);
    }
    return { prose, groups };
}

function renderEntries({ prose, groups }) {
    const ordered = [
        ...CATEGORY_ORDER.filter((key) => groups.has(key)),
        ...[...groups.keys()].filter((key) => !CATEGORY_ORDER.includes(key)),
    ];

    const parts = [];
    if (prose.length > 0) parts.push(prose.join('\n'));
    for (const key of ordered) {
        const items = groups.get(key);
        if (items && items.length > 0) parts.push(`${key}\n\n${items.join('\n')}`);
    }
    return parts.join('\n\n');
}

/** Concatenates two entry blocks, `earlier` first, removing duplicate lines. */
function mergeEntries(earlier, later) {
    const a = parseEntries(earlier);
    const b = parseEntries(later);

    const groups = new Map();
    for (const [key, items] of a.groups) groups.set(key, [...items]);
    for (const [key, items] of b.groups) {
        groups.set(key, [...new Set([...(groups.get(key) ?? []), ...items])]);
    }
    return renderEntries({ prose: [...new Set([...a.prose, ...b.prose])], groups });
}

function buildChangelog({ head, unreleased, sections, links }) {
    const blocks = [head, '', UNRELEASED_HEADING];
    if (unreleased.trim()) blocks.push('', unreleased.trim());

    for (const section of sections) {
        blocks.push('', section.title);
        if (section.body.trim()) blocks.push('', section.body.trim());
    }
    blocks.push('', links.join('\n'), '');
    return blocks.join('\n').replace(/\n{3,}/g, '\n\n');
}

// --- main ------------------------------------------------------------------

function emitOutput(key, value) {
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
}

function writeVersion(path, nextVersion, patchLock = false) {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    json.version = nextVersion;
    if (patchLock && json.packages?.['']) {
        json.packages[''].version = nextVersion;
    }
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

/**
 * The last released version, taken as the highest of the base branch manifest
 * and the newest tag reachable from it. Both are consulted because either can
 * lag: the manifest was introduced late in the project's life, and tags may be
 * missing on a shallow clone.
 */
function readBaseVersion() {
    const candidates = [];
    try {
        candidates.push(parseVersion(JSON.parse(gitQuiet('show', `${baseRef}:${PACKAGE_PATH}`)).version));
    } catch {
        // The manifest is unreadable on the base branch; fall back to tags.
    }
    try {
        candidates.push(parseVersion(gitQuiet('describe', '--tags', '--abbrev=0', baseRef).replace(/^v/, '')));
    } catch {
        // No tag is reachable from the base branch; fall back to the manifest.
    }
    if (candidates.length === 0) {
        throw new Error(`Unable to determine the released version of ${baseRef}`);
    }
    return candidates.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
}

function main() {
    const baseVersion = readBaseVersion();

    const changelog = splitChangelog(readFileSync(CHANGELOG_PATH, 'utf8'));
    let { unreleased, sections, links } = changelog;

    // Step 1 — undo the previous preparation, if any. A section newer than the
    // base branch has not been released yet, so its entries belong back in
    // [Unreleased] before the version is recomputed.
    const leading = sections[0] ? readVersionHeading(sections[0].title) : null;
    let preparedVersion = null;
    if (leading && compareVersions(parseVersion(leading.version), baseVersion) > 0) {
        preparedVersion = leading.version;
        unreleased = mergeEntries(sections[0].body, unreleased);
        sections = sections.slice(1);
        links = links.filter((line) => !line.startsWith(`[${preparedVersion}]:`));
        console.log(`Reverting the previous preparation of v${preparedVersion}.`);
    }

    // Step 2 — recompute from the full range, ignoring this script's commits.
    const commits = readCommits();
    if (commits.length === 0) {
        console.log(`No releasable commits between ${baseRef} and HEAD.`);
        emitOutput('version', '');
        emitOutput('changed', 'false');
        return;
    }

    const bump = decideBump(commits, baseVersion);
    const nextVersion = formatVersion(applyBump(baseVersion, bump));
    const date = tokyoDate();

    // Step 3 — prepare again from the clean state.
    const entries = renderEntries(parseEntries(unreleased));
    sections = [{ title: `## [${nextVersion}] - ${date}`, body: entries }, ...sections];
    links = [
        `[Unreleased]: ${REPO_URL}/compare/v${nextVersion}...develop`,
        `[${nextVersion}]: ${REPO_URL}/compare/v${formatVersion(baseVersion)}...v${nextVersion}`,
        ...links.filter((line) => !line.startsWith('[Unreleased]:')),
    ];

    console.log(`${commits.length} releasable commit(s) since ${baseRef} -> ${bump} bump`);
    console.log(`${formatVersion(baseVersion)} -> ${nextVersion} (${date})`);
    if (preparedVersion && preparedVersion !== nextVersion) {
        console.log(`Version recomputed: v${preparedVersion} -> v${nextVersion}`);
    }
    if (!entries.trim()) {
        console.log('::warning::CHANGELOG の [Unreleased] が空である。リリース内容を手動で追記すること。');
    }

    if (dryRun) {
        console.log('--dry-run: no files written.');
    } else {
        writeFileSync(CHANGELOG_PATH, buildChangelog({ head: changelog.head, unreleased: '', sections, links }));
        writeVersion(PACKAGE_PATH, nextVersion);
        // The lockfile mirrors the manifest version in two places; keeping them
        // in sync avoids a spurious diff on the next `npm install`.
        writeVersion(LOCKFILE_PATH, nextVersion, true);
    }

    emitOutput('version', nextVersion);
    emitOutput('changed', 'true');
}

main();

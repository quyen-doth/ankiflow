#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const MAIN_REF = 'refs/heads/main';
const CHANGELOG_PATH = 'CHANGELOG.md';

function fail(reason) {
    return {
        outcome: 'fail',
        createTag: false,
        createRelease: false,
        reason,
    };
}

export function decideReleaseActions({
    version,
    ref,
    tagExists,
    tagCommitSha,
    tagIsAncestor,
    headSha,
    releaseExists,
    releaseNotesPresent,
}) {
    if (ref !== MAIN_REF) {
        return fail(`main 以外の ref (${ref}) からリリースは作成できない。`);
    }
    if (!releaseNotesPresent) {
        return fail(`CHANGELOG に v${version} のリリースノートが存在しない。`);
    }
    if (tagExists && tagCommitSha !== headSha && !tagIsAncestor) {
        return fail(`タグ v${version} は別のコミット ${tagCommitSha} を指している。`);
    }

    const createTag = !tagExists;
    const createRelease = !releaseExists;
    if (!createTag && !createRelease) {
        return {
            outcome: 'noop',
            createTag,
            createRelease,
            reason: `タグと GitHub Release v${version} は既に存在する。`,
        };
    }

    return {
        outcome: 'ready',
        createTag,
        createRelease,
        reason: `v${version} の不足しているリリース成果物を作成する。`,
    };
}

export function extractReleaseNotes(changelog, version) {
    const heading = `## [${version}]`;
    const lines = changelog.split('\n');
    const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
    if (start === -1) return '';

    const remaining = lines.slice(start + 1);
    const nextSection = remaining.findIndex((line) => line.startsWith('## '));
    return (nextSection === -1 ? remaining : remaining.slice(0, nextSection)).join('\n').trim();
}

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} が設定されていない。`);
    return value;
}

function parseBoolean(value, name) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`${name} は true または false でなければならない。`);
}

function exactTagState(version, headSha) {
    const tagRef = `refs/tags/v${version}`;
    try {
        execFileSync('git', ['show-ref', '--verify', '--quiet', tagRef], { stdio: 'ignore' });
    } catch (error) {
        if (error && typeof error === 'object' && error.status === 1) {
            return { tagExists: false, tagCommitSha: null, tagIsAncestor: false };
        }
        throw error;
    }

    const tagCommitSha = execFileSync('git', ['rev-parse', `${tagRef}^{commit}`], {
        encoding: 'utf8',
    }).trim();
    let tagIsAncestor = false;
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', tagRef, headSha], { stdio: 'ignore' });
        tagIsAncestor = true;
    } catch (error) {
        if (!(error && typeof error === 'object' && error.status === 1)) throw error;
    }
    return { tagExists: true, tagCommitSha, tagIsAncestor };
}

function emitOutput(key, value) {
    appendFileSync(requiredEnv('GITHUB_OUTPUT'), `${key}=${value}\n`);
}

function main() {
    const version = requiredEnv('VERSION');
    const ref = requiredEnv('RELEASE_REF');
    const headSha = requiredEnv('HEAD_SHA');
    const releaseExists = parseBoolean(requiredEnv('RELEASE_EXISTS'), 'RELEASE_EXISTS');
    const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
    const releaseNotes = extractReleaseNotes(changelog, version);
    const { tagExists, tagCommitSha, tagIsAncestor } = exactTagState(version, headSha);
    const decision = decideReleaseActions({
        version,
        ref,
        tagExists,
        tagCommitSha,
        tagIsAncestor,
        headSha,
        releaseExists,
        releaseNotesPresent: releaseNotes.length > 0,
    });

    emitOutput('version', version);
    emitOutput('tag_exists', String(tagExists));
    emitOutput('tag_commit_sha', tagCommitSha ?? '');
    emitOutput('tag_is_ancestor', String(tagIsAncestor));
    emitOutput('release_exists', String(releaseExists));
    emitOutput('create_tag', String(decision.createTag));
    emitOutput('create_release', String(decision.createRelease));
    emitOutput('outcome', decision.outcome);

    if (decision.outcome === 'fail') {
        console.error(`::error::${decision.reason}`);
        process.exitCode = 1;
        return;
    }

    const notesPath = process.env.RELEASE_NOTES_PATH;
    if (notesPath) writeFileSync(notesPath, `${releaseNotes}\n`);

    if (decision.createTag) console.log(`タグ v${version} を作成する。`);
    else console.log(`タグ v${version} は既に存在するため、作成をスキップする。`);

    if (decision.createRelease) console.log(`GitHub Release v${version} を作成する。`);
    else console.log(`GitHub Release v${version} は既に存在するため、作成をスキップする。`);

    if (decision.outcome === 'noop') console.log(decision.reason);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) main();

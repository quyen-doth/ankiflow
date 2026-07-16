#!/usr/bin/env node
// Shared PreToolUse hook for Claude Code (.claude/settings.json) and Codex (.codex/hooks.json).
// Blocks access to dotenv secrets while allowing the public .env.example template.
import { readFileSync } from 'fs';
const input = JSON.parse(readFileSync('/dev/stdin', 'utf8'));
const tool = input.tool_name;

const ENV_FILE_PATTERN = /\.env(?:\.[A-Za-z0-9_-]+)*/g;
const ALLOWED_ENV_FILE = '.env.example';

function containsProtectedEnv(value) {
    if (typeof value === 'string') {
        for (const match of value.matchAll(ENV_FILE_PATTERN)) {
            const before = value[match.index - 1];
            const after = value[match.index + match[0].length];
            const endsAtFilenameBoundary = !after || !/[A-Za-z0-9_-]/.test(after);
            const isAllowedExample = (
                match[0] === ALLOWED_ENV_FILE &&
                (!before || !/[A-Za-z0-9_-]/.test(before))
            );

            if (endsAtFilenameBoundary && !isAllowedExample) {
                return true;
            }
        }

        return false;
    }

    if (Array.isArray(value)) {
        return value.some(containsProtectedEnv);
    }

    if (value && typeof value === 'object') {
        return Object.values(value).some(containsProtectedEnv);
    }

    return false;
}

if (['Read', 'Edit', 'Write'].includes(tool)) {
    if (containsProtectedEnv(input.tool_input?.file_path || '')) {
        process.stderr.write('🚫 Blocked: .env files are off-limits.');
        process.exit(2);
    }
}

if (tool === 'Bash' || tool === 'Grep') {
    if (containsProtectedEnv(input.tool_input || {})) {
        process.stderr.write('🚫 Blocked: cannot access .env via ' + tool);
        process.exit(2);
    }
}

process.exit(0);

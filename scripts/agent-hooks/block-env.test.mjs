import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HOOK_PATH = fileURLToPath(new URL('./block-env.mjs', import.meta.url));

function runHook(toolName, toolInput) {
    return spawnSync(process.execPath, [HOOK_PATH], {
        encoding: 'utf8',
        input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    });
}

function assertBlocked(toolName, toolInput) {
    const result = runHook(toolName, toolInput);
    assert.equal(result.status, 2, `expected hook to block; stderr: ${result.stderr}`);
}

function assertAllowed(toolName, toolInput) {
    const result = runHook(toolName, toolInput);
    assert.equal(result.status, 0, `expected hook to allow; stderr: ${result.stderr}`);
}

test('blocks standard and suffix-style dotenv filenames', () => {
    for (const filePath of [
        '.env',
        '.env.local',
        'secrets.env',
        'prod.env',
        'config/production.env',
        'config/production.env.local',
    ]) {
        assertBlocked('Read', { file_path: filePath });
    }
});

test('blocks nested Bash and Grep inputs that reference dotenv secrets', () => {
    assertBlocked('Bash', { command: 'read config/production.env' });
    assertBlocked('Grep', { pattern: 'TOKEN', paths: ['safe.txt', 'secrets.env'] });
});

test('allows only the exact public dotenv example filename', () => {
    assertAllowed('Read', { file_path: '.env.example' });
    assertAllowed('Read', { file_path: 'config/.env.example' });
    assertBlocked('Read', { file_path: 'secrets.env.example' });
    assertBlocked('Read', { file_path: '.env.example.local' });
});

test('does not treat longer non-dotenv words as secret filenames', () => {
    assertAllowed('Read', { file_path: 'docs/.environment' });
    assertAllowed('Grep', { pattern: 'process.environment', path: 'docs/reference.md' });
});

#!/usr/bin/env node
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const tool = input.tool_name;
const args = JSON.stringify(input.tool_input || {});

const envPattern = /\.env(\.\w+)?/;

if (['Read', 'Edit', 'Write'].includes(tool)) {
    if (envPattern.test(input.tool_input?.file_path || '')) {
        process.stderr.write('🚫 Blocked: .env files are off-limits.');
        process.exit(2);
    }
}

if (tool === 'Bash' || tool === 'Grep') {
    if (envPattern.test(args)) {
        process.stderr.write('🚫 Blocked: cannot access .env via ' + tool);
        process.exit(2);
    }
}

process.exit(0);

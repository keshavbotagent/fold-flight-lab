// Local publishing fallback: native Sites tools handle registration and deployment.
// Credentials exist only in stdin and the child process environment.
import { spawn } from 'node:child_process';
import { readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write('Ready for publish JSON on stdin (input is hidden).\n');
const input = await new Promise((resolve, reject) => {
  let buffer = '';
  process.stdin.setEncoding('utf8');
  const accept = chunk => {
    buffer += chunk;
    if (!buffer.includes('\n')) return;
    process.stdin.off('data', accept);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    try { resolve(JSON.parse(buffer.slice(0, buffer.indexOf('\n')))); }
    catch { reject(new Error('Invalid publishing input.')); }
  };
  process.stdin.on('data', accept);
});

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${command} failed (${code}): ${stderr.replaceAll(input.credential.token, '[redacted]')}`)));
  });
}

const manifest = JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (manifest.project_id !== input.project_id || manifest.static?.directory !== 'dist') throw new Error('Site identity or static output mismatch.');
const credential = input.credential;
if (credential.auth_mode !== 'http_extra_header' || !credential.token) throw new Error('Unsupported source authentication mode.');
const remote = new URL(credential.remote_url);
if (remote.protocol !== 'https:' || remote.username || remote.password) throw new Error('Expected a credential-free HTTPS source URL.');
if (new Date(credential.token_expires_at) <= new Date()) throw new Error('Source credential expired.');
try { await stat(path.join(root, '.git')); }
catch { await run('git', ['init', '-b', credential.branch]); }
await run('git', ['config', 'user.name', 'Flight Lab']);
await run('git', ['config', 'user.email', 'flight-lab@local.invalid']);
await run('git', ['remote', 'remove', 'origin']).catch(() => {});
await run('git', ['remote', 'add', 'origin', credential.remote_url]);
await run('git', ['add', '-A']);
const changes = await run('git', ['status', '--porcelain']);
if (changes) await run('git', ['commit', '-m', 'Build and validate Three.js paper plane flight lab']);
const commit = await run('git', ['rev-parse', 'HEAD']);
const gitEnv = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraHeader', GIT_CONFIG_VALUE_0: `Authorization: Bearer ${credential.token}`, GIT_TERMINAL_PROMPT: '0' };
await run('git', ['push', '--set-upstream', 'origin', `HEAD:${credential.branch}`], gitEnv);
const remoteHead = await run('git', ['ls-remote', 'origin', `refs/heads/${credential.branch}`], gitEnv);
if (remoteHead.split(/\s+/)[0] !== commit) throw new Error('Pushed source revision did not match local HEAD.');
await stat(path.join(root, 'dist/index.html'));
await mkdir(path.dirname(input.archivePath), { recursive: true });
await run('tar', ['-czf', input.archivePath, '.openai/hosting.json', 'dist']);
const contents = await run('tar', ['-tzf', input.archivePath]);
if (!contents.includes('dist/index.html') || !contents.includes('.openai/hosting.json')) throw new Error('Incomplete deployment archive.');
process.stdout.write(JSON.stringify({ project_id: manifest.project_id, checkout_path: root, commit_sha: commit, archive: input.archivePath }) + '\n');

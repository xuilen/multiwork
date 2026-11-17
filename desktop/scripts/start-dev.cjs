const { spawnSync } = require('node:child_process')
const os = require('node:os')
const path = require('node:path')

const configRoot = process.platform === 'win32'
  ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')

const profile = path.join(configRoot, 'meldwork-studio-development')
const result = spawnSync(require('electron'), ['.', `--user-data-dir=${profile}`, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1

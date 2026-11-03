const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'db.json');
const destinationDirectory = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'backups'));
if (!fs.existsSync(source)) throw new Error(`Database file not found: ${source}`);
fs.mkdirSync(destinationDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(destinationDirectory, `db-${stamp}.json`);
fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
console.log(`Backup created: ${destination}`);

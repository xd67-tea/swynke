// Rebuild index.html from src/template.html and content.json, using the same
// render code as the Apps Script editor (apps-script/Code.gs).
// Usage: node tools/render.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), ctx);
const template = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
const html = ctx.renderSite_(template, content, false);
if (/\{\{[a-z0-9_-]+\}\}/i.test(html)) throw new Error('Unfilled slot left in the page');
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html written,', html.length, 'bytes');

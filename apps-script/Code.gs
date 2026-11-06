/**
 * Swynke site editor.
 * A web app bound to a Google Sheet. People with edit access to the Sheet can
 * edit the site's words in place, save versions, restore earlier ones and
 * publish to the live site (GitHub repo -> Vercel deploys automatically).
 *
 * Script properties (Project Settings > Script properties):
 *   GITHUB_TOKEN   fine-grained token, repo xd67-tea/swynke only, Contents: read and write
 *   GITHUB_REPO    xd67-tea/swynke
 *   GITHUB_BRANCH  main (optional)
 *   SHEET_ID       only if this script was not created from the Sheet's Extensions menu
 */

var KEEP_VERSIONS = 10;      // the brief asked for at least 5
var SHEET_VERSIONS = 'Versions';
var SHEET_PUBLISHED = 'Published';
var SHEET_CURRENT = 'Current text';

/* ---------- web app ---------- */

function doGet() {
  var state = getState();
  var html = renderSite_(getTemplate_(), state.content, true);
  var editor = HtmlService.createHtmlOutputFromFile('Editor').getContent();
  html = html.replace('</body>', '<script>window.SWYNKE_STATE = ' + safeJson_(publicState_(state)) + ';</script>\n' + editor + '\n</body>');
  return HtmlService.createHtmlOutput(html)
    .setTitle('Swynke site editor')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- called from the editor ---------- */

function getState() {
  var sh = sheet_(SHEET_VERSIONS);
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues() : [];
  if (!rows.length) throw new Error('No saved versions yet. Run setup() once from the script editor.');
  var latest = rows[rows.length - 1];
  return {
    content: withDefaults_(JSON.parse(latest[4])),
    version: String(latest[0]),
    versions: rows.map(function (r) { return { id: String(r[0]), time: fmt_(r[1]), user: r[2], note: r[3] }; }).reverse(),
    published: lastPublished_()
  };
}

function saveVersion(content, baseVersion, note) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var state = getState();
    if (baseVersion && state.version !== baseVersion) {
      return { conflict: true, state: publicState_(state) };
    }
    var clean = cleanContent_(content, state.content);
    appendVersion_(clean, note || '');
    return { conflict: false, state: publicState_(getState()) };
  } finally {
    lock.releaseLock();
  }
}

function getVersion(id) {
  var sh = sheet_(SHEET_VERSIONS);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) return JSON.parse(rows[i][4]);
  throw new Error('That version is no longer kept.');
}

function publishVersion(version) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var state = getState();
    if (version !== state.version) throw new Error('Someone saved a newer version. Reload the editor, check it, then publish.');
    var html = renderSite_(getTemplate_(), state.content, false);
    var who = user_() || 'someone';
    var commit = commitFiles_({
      'index.html': html,
      'content.json': JSON.stringify(state.content, null, 1) + '\n'
    }, 'Publish site text from the editor (' + who + ')');
    sheet_(SHEET_PUBLISHED).appendRow([new Date(), who, state.version, commit.sha, commit.url]);
    return publicState_(getState());
  } finally {
    lock.releaseLock();
  }
}

/* ---------- one-time setup ---------- */

function setup() {
  var content = JSON.parse(githubGet_('content.json'));
  var v = sheet_(SHEET_VERSIONS);
  if (v.getLastRow() < 1) v.appendRow(['Version', 'Saved', 'By', 'Note', 'Content (JSON)']);
  sheet_(SHEET_PUBLISHED).getLastRow() < 1 && sheet_(SHEET_PUBLISHED).appendRow(['Published', 'By', 'Version', 'Commit', 'Link']);
  if (v.getLastRow() < 2) appendVersion_(content, 'Imported from the live site');
  Logger.log('Ready. Deploy > New deployment > Web app.');
}

function withDefaults_(content) {
  // If the template has gained new text slots since this version was saved, fill them from content.json in the repo.
  var missing = [];
  getTemplate_().replace(/\{\{([a-z0-9_-]+)\}\}/gi, function (m, k) { if (!content.hasOwnProperty(k)) missing.push(k); return m; });
  if (!missing.length) return content;
  var defaults = JSON.parse(githubGet_('content.json'));
  missing.forEach(function (k) { if (defaults.hasOwnProperty(k)) content[k] = defaults[k]; });
  return content;
}

/* ---------- rendering (shared with tools/render.js) ---------- */

var ALLOWED_TAGS_ = /^(em|b|strong|br)$/i;

function sanitizeFragment_(html) {
  html = String(html == null ? '' : html)
    .replace(/<div>|<p>/gi, '<br>').replace(/<\/div>|<\/p>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<(\/?)([a-z0-9]+)[^>]*>/gi, function (m, close, tag) {
      return ALLOWED_TAGS_.test(tag) ? '<' + close + tag.toLowerCase() + '>' : '';
    })
    .replace(/&(?!(amp|lt|gt|quot|#39|#\d+|#x[0-9a-f]+|[a-z]+);)/gi, '&amp;')
    .replace(/(<br>\s*)+$/i, '')
    .trim();
  return html;
}

function escapeAttr_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeJson_(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
}

function renderSite_(template, content, editor) {
  return template.replace(/\{\{([a-z0-9_-]+)\}\}/gi, function (m, key) {
    if (key === '__mixer') return safeJson_(content.__mixer || []);
    if (key === 'meta-description') return escapeAttr_(content[key]);
    return content.hasOwnProperty(key) ? sanitizeFragment_(content[key]) : '';
  });
}

function cleanContent_(content, previous) {
  var out = {};
  Object.keys(previous).forEach(function (k) {
    if (k === '__mixer') out[k] = cleanMixer_(content.__mixer, previous.__mixer);
    else if (k === 'meta-description') out[k] = String(content.hasOwnProperty(k) ? content[k] : previous[k]).replace(/<[^>]*>/g, '').trim();
    else out[k] = sanitizeFragment_(content.hasOwnProperty(k) ? content[k] : previous[k]);
  });
  return out;
}

function cleanMixer_(mix, previous) {
  if (!Array.isArray(mix) || !mix.length) return previous;
  return mix.slice(0, 8).map(function (p) {
    var rows = (p.m || []).slice(0, 5).map(function (r) {
      return [String(r[0] || '').replace(/<[^>]*>/g, ''), Math.max(0, Math.min(100, Math.round(Number(r[1]) || 0))), String(r[2] || '').replace(/<[^>]*>/g, '')];
    }).filter(function (r) { return r[0] && r[1] > 0; });
    return { q: String(p.q || '').replace(/<[^>]*>/g, ''), m: rows };
  }).filter(function (p) { return p.q && p.m.length; });
}

/* ---------- storage ---------- */

function appendVersion_(content, note) {
  var sh = sheet_(SHEET_VERSIONS);
  sh.appendRow([String(Date.now()), new Date(), user_(), note, JSON.stringify(content)]);
  var extra = sh.getLastRow() - 1 - KEEP_VERSIONS;
  if (extra > 0) sh.deleteRows(2, extra);
  writeCurrent_(content);
}

function writeCurrent_(content) {
  // A readable copy of the latest saved text, one row per slot. The Versions sheet is the source of truth.
  var sh = sheet_(SHEET_CURRENT);
  sh.clearContents();
  var rows = [['Slot', 'Text']];
  Object.keys(content).forEach(function (k) {
    rows.push([k, k === '__mixer' ? JSON.stringify(content[k]) : content[k]]);
  });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
}

function lastPublished_() {
  var sh = sheet_(SHEET_PUBLISHED);
  if (sh.getLastRow() < 2) return null;
  var r = sh.getRange(sh.getLastRow(), 1, 1, 5).getValues()[0];
  return { time: fmt_(r[0]), user: r[1], version: String(r[2]), url: r[4] };
}

function publicState_(s) {
  return { content: s.content, version: s.version, versions: s.versions, published: s.published, me: user_() };
}

function sheet_(name) {
  // Works whether the script was opened from the Sheet (Extensions > Apps Script)
  // or created separately, in which case set the SHEET_ID script property.
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('This script isn\'t attached to a Sheet. Add a SHEET_ID script property with the Sheet\'s ID (the long code in its URL between /d/ and /edit).');
    ss = SpreadsheetApp.openById(id);
  }
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function user_() {
  try { return Session.getActiveUser().getEmail(); } catch (e) { return ''; }
}

function fmt_(d) {
  return Utilities.formatDate(new Date(d), 'Australia/Sydney', 'd MMM yyyy, h:mm a');
}

/* ---------- GitHub ---------- */

function gh_(method, path, body) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('GITHUB_TOKEN');
  var repo = p.getProperty('GITHUB_REPO') || 'xd67-tea/swynke';
  if (!token) throw new Error('GITHUB_TOKEN is not set in Script properties.');
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + path, {
    method: method,
    contentType: 'application/json',
    payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('GitHub said ' + code + ': ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}

function branch_() {
  return PropertiesService.getScriptProperties().getProperty('GITHUB_BRANCH') || 'main';
}

function githubGet_(path) {
  var f = gh_('get', '/contents/' + path + '?ref=' + branch_());
  return Utilities.newBlob(Utilities.base64Decode(f.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
}

function getTemplate_() {
  var cache = CacheService.getScriptCache();
  var t = cache.get('template');
  if (t) return t;
  t = githubGet_('src/template.html');
  if (t.length < 90000) cache.put('template', t, 300);
  return t;
}

function commitFiles_(files, message) {
  // One commit containing every file, so Vercel deploys once.
  var b = branch_();
  var ref = gh_('get', '/git/ref/heads/' + b);
  var head = gh_('get', '/git/commits/' + ref.object.sha);
  var tree = gh_('post', '/git/trees', {
    base_tree: head.tree.sha,
    tree: Object.keys(files).map(function (path) {
      return { path: path, mode: '100644', type: 'blob', content: files[path] };
    })
  });
  var commit = gh_('post', '/git/commits', { message: message, tree: tree.sha, parents: [ref.object.sha] });
  gh_('patch', '/git/refs/heads/' + b, { sha: commit.sha });
  return { sha: commit.sha, url: commit.html_url };
}

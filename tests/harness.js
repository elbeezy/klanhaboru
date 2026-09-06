/* Test machinery for SZEM4.
 *
 * SZEM4 is one big file that only fully runs inside the game, so the tests do
 * not load it as a module. They cut individual functions out of the source
 * text and run those, which means the tests exercise the real code rather than
 * a copy of it that can quietly drift.
 *
 * Nothing here knows anything about SZEM4 itself -- the tests live in tests.js.
 */

var SZEM4_SRC = '';          // the source text under test, filled in by index.html
var PREVIEW_SRC = '';   /* tests/preview.html, for the mirror check */
var SUITES = [];
var RESULTS = { pass: 0, fail: 0, lines: [] };
var CURRENT = null;

function suite(name, fn) { SUITES.push({ name: name, fn: fn }); }

function ok(cond, label, detail) {
	if (cond) { RESULTS.pass++; CURRENT.lines.push(['pass', label, '']); }
	else { RESULTS.fail++; CURRENT.lines.push(['fail', label, detail === undefined ? '' : String(detail)]); }
	return !!cond;
}

/* Comparison by value, so a failure says what it actually got. */
function eq(actual, expected, label) {
	var a = JSON.stringify(actual), b = JSON.stringify(expected);
	return ok(a === b, label, 'expected ' + b + ', got ' + a);
}

function throws(fn, label, mustMention) {
	try { fn(); }
	catch (e) {
		if (mustMention && String(e.message).indexOf(mustMention) === -1) {
			return ok(false, label, 'threw, but without "' + mustMention + '": ' + e.message);
		}
		return ok(true, label);
	}
	return ok(false, label, 'did not throw');
}

/* ---------------------------------------------------------------- slicing */

/* True when a "/" at this point starts a regular expression rather than being
   a divide. Looks back at the last meaningful character: after a value you can
   only be dividing, after an operator or an opening bracket you cannot be. */
function regexCanStartHere(src, i) {
	for (var j = i - 1; j >= 0; j--) {
		var c = src[j];
		if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
		if (')]}'.indexOf(c) !== -1) return false;
		if (/[A-Za-z0-9_$]/.test(c)) {
			var word = /[A-Za-z0-9_$]+$/.exec(src.slice(0, j + 1))[0];
			return ['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else']
				.indexOf(word) !== -1;
		}
		return true;
	}
	return true;
}

/* Walk forward from `from`, returning the index just past the matching brace
   of the first "{" found. Skips strings, comments and regular expressions so
   that a brace inside any of them does not confuse the count -- SZEM4 really
   does contain regexes such as /[0-9]{1,3}/. */
function matchBraces(src, from) {
	var i = src.indexOf('{', from), depth = 0;
	for (; i < src.length; i++) {
		var c = src[i], n = src[i + 1];
		if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i === -1) break; continue; }
		if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; continue; }
		if (c === '"' || c === "'" || c === '`') {
			var q = c;
			for (i++; i < src.length; i++) {
				if (src[i] === '\\') { i++; continue; }
				if (src[i] === q) break;
			}
			continue;
		}
		if (c === '/' && regexCanStartHere(src, i)) {
			for (i++; i < src.length; i++) {
				if (src[i] === '\\') { i++; continue; }
				if (src[i] === '[') { while (i < src.length && src[i] !== ']') { if (src[i] === '\\') i++; i++; } continue; }
				if (src[i] === '/') break;
				if (src[i] === '\n') break; // not a regex after all; bail out safely
			}
			continue;
		}
		if (c === '{') depth++;
		else if (c === '}') { depth--; if (depth === 0) return i + 1; }
	}
	throw new Error('unbalanced braces from index ' + from);
}

/* A named top-level function, as text. Verified to parse on the way out, so a
   mis-cut fails here with a clear message instead of somewhere confusing. */
function sliceFn(src, name) {
	var start = src.indexOf('function ' + name + '(');
	if (start === -1) start = src.indexOf('function ' + name + ' (');
	if (start === -1) throw new Error('no such function in source: ' + name);
	var text = src.slice(start, matchBraces(src, start));
	try { new Function(text); }
	catch (e) { throw new Error('sliced ' + name + ' does not parse: ' + e.message); }
	return text;
}

/* Everything from a marker line through the end of a named function -- used
   where the declarations a function needs sit just above it. */
function sliceFrom(src, marker, lastFn) {
	var start = src.indexOf(marker);
	if (start === -1) throw new Error('marker not found: ' + marker);
	var last = sliceFn(src, lastFn);
	var end = src.indexOf(last) + last.length;
	if (end < start) throw new Error('marker comes after ' + lastFn);
	return src.slice(start, end);
}

/* A document.addEventListener(...) registration, as text. */
function sliceListener(src, eventName) {
	var start = src.indexOf("document.addEventListener('" + eventName + "'");
	if (start === -1) throw new Error('no listener for ' + eventName);
	var end = matchBraces(src, start);
	end = src.indexOf(')', end) + 1;
	return src.slice(start, end);
}

/* Source with comments removed, strings left exactly as they were.
 *
 * Tests that scan the file for markup need this: verifyInlineHandlers() reads
 * the built interface, so it never sees comments, and a test scanning the raw
 * text would trip over prose that merely describes a handler.
 *
 * Strings are skipped first, so "https://..." keeps its slashes. Whether that
 * holds is not taken on trust -- the caller checks the result still parses.
 */
function stripComments(src) {
	var out = '', i = 0;
	while (i < src.length) {
		var c = src[i], n = src[i + 1];
		if (c === '/' && n === '/') {
			var nl = src.indexOf('\n', i);
			if (nl === -1) break;
			i = nl;                       // keep the newline, drop the comment
			continue;
		}
		if (c === '/' && n === '*') {
			var close = src.indexOf('*/', i + 2);
			i = close === -1 ? src.length : close + 2;
			out += ' ';
			continue;
		}
		if (c === '"' || c === "'" || c === '`') {
			var q = c, start = i;
			for (i++; i < src.length; i++) {
				if (src[i] === '\\') { i++; continue; }
				if (src[i] === q) { i++; break; }
			}
			out += src.slice(start, i);
			continue;
		}
		if (c === '/' && regexCanStartHere(src, i)) {
			var rstart = i;
			for (i++; i < src.length; i++) {
				if (src[i] === '\\') { i++; continue; }
				if (src[i] === '[') { while (i < src.length && src[i] !== ']') { if (src[i] === '\\') i++; i++; } continue; }
				if (src[i] === '/') { i++; break; }
				if (src[i] === '\n') break;
			}
			out += src.slice(rstart, i);
			continue;
		}
		out += c;
		i++;
	}
	return out;
}

/* ------------------------------------------------------------- sandboxing */

/* Run sliced source against a fake world.
 *
 * The bodies run inside `with (world)`, NOT with the world's values passed in
 * as arguments. That matters: assigning to something like FARM_PAUSE has to
 * write through to the world object, or a test comparing before and after sees
 * nothing change and passes while checking nothing at all.
 *
 * Anything the sliced code declares with `var` stays local to the sandbox, so
 * pass `expose` to read those back, e.g. { vege: 'SZUNET_MIND_VEGE' }.
 */
function sandbox(world, bodies, expose) {
	var src = [].concat(bodies).join('\n\n');
	var names = [];
	var re = /(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g, m;
	while ((m = re.exec(src))) names.push(m[1]);

	var parts = names.map(function (n) {
		return JSON.stringify(n) + ': typeof ' + n + " === 'function' ? " + n + ' : undefined';
	});
	for (var key in (expose || {})) {
		parts.push(JSON.stringify(key) + ': function(){ return ' + expose[key] + '; }');
	}
	var fn = new Function('__world', 'with (__world) {\n' + src + '\nreturn {' + parts.join(',\n') + '};\n}');
	return fn(world);
}

/* --------------------------------------------------------------- fake DOM */

function fakeEl(text, extra) {
	var el = { textContent: text === undefined ? '' : text, innerHTML: '', title: '', src: '', alt: '', cells: [] };
	for (var k in (extra || {})) el[k] = extra[k];
	if (!el.querySelector) el.querySelector = function () { return null; };
	return el;
}

/* A build row as the game writes it: name, wood, stone, iron, time, population,
   options. `opts.maxed` drops the cost cells and the build button, which is
   what the game does for a building that cannot be raised any further. */
function buildRow(opts) {
	opts = opts || {};
	if (opts.maxed) {
		return { cells: [fakeEl('Tanya'), fakeEl('Épület teljesen felépítve')], querySelector: function () { return null; } };
	}
	var btn = opts.noButton ? null : { className: 'btn btn-build' };
	return {
		cells: [
			fakeEl(opts.name || 'Fa'),
			fakeEl(opts.wood === undefined ? '0' : String(opts.wood)),
			fakeEl(opts.stone === undefined ? '0' : String(opts.stone)),
			fakeEl(opts.iron === undefined ? '0' : String(opts.iron)),
			fakeEl(opts.time === undefined ? '0:00:10' : opts.time),
			fakeEl(opts.pop === undefined ? '0' : String(opts.pop)),
			fakeEl('')
		],
		querySelector: function (sel) { return sel === '.btn.btn-build' ? btn : null; }
	};
}

/* ---------------------------------------------------------------- running */

function runAll() {
	SUITES.forEach(function (s) {
		CURRENT = { name: s.name, lines: [] };
		RESULTS.lines.push(CURRENT);
		try { s.fn(); }
		catch (e) {
			RESULTS.fail++;
			CURRENT.lines.push(['fail', 'suite threw before finishing', e.message + '\n' + (e.stack || '')]);
		}
	});
	return RESULTS;
}

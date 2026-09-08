/* What SZEM4 has to keep doing.
 *
 * Each suite cuts the real functions out of scripts/SZEM4.js and runs them, so
 * these tests fail when the source changes behaviour rather than when a copy of
 * it goes stale. See README.md for how to add one.
 */

/* The 50 names SZEM4 puts on window. Inline handlers in the built interface can
   only call these, and verifyInlineHandlers() checks that at startup, so the
   list is a real contract rather than bookkeeping. Add a name here in the same
   commit that exports it. */
var EXPECTED_EXPORTS = [
	'BotvedelemBe', 'BotvedelemKi', 'addTooltip_build', 'add_farmolando',
	'add_farmolo', 'alert2', 'debug_urit', 'gyujto_setMaxOra',
	'gyujto_setStrategia', 'gyujto_setVill',
	'hattercsere', 'hattertolor', 'learnCatapult', 'loadCloudDataIntoLocal',
	'modosit_szam', 'naplo', 'nyit', 'onWallpChange',
	'playSound', 'removeTooltip', 'rendez', 'restartKieg',
	'saveLocalDataToCloud', 'saveSettings', 'selectTheme', 'setTooltip',
	'sortorol', 'stopEvent', 'sugo', 'switchMobileMode',
	'szem4_ADAT_LoadAll', 'szem4_ADAT_betolt', 'szem4_ADAT_del', 'szem4_ADAT_kiir',
	'szem4_ADAT_loadNow', 'szem4_ADAT_restart', 'szem4_ADAT_saveNow', 'szem4_BEF_mind',
	'szem4_BEF_setVill', 'szem4_EPITO_cscheck',
	'szem4_EPITO_csopDelete', 'szem4_EPITO_infoCell', 'szem4_EPITO_most', 'szem4_EPITO_perccsokkento',
	'szem4_EPITO_ujCsop', 'szem4_EPITO_ujFalu', 'szem4_GYUJTO_search', 'szem4_farmolo_csoport',
	'szem4_farmolo_multiclick', 'szem4_vije_forgot', 'szunet', 'szunetMind',
	'updateDefaultProdHour', 'validate', 'farmStatNullaz'
];

function exportedNames() {
	var block = SZEM4_SRC.slice(SZEM4_SRC.indexOf('Object.assign(window, {'));
	block = block.slice(block.indexOf('{') + 1, block.indexOf('});'));
	return block.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/* SZEM's icon drawing, compiled into a window that has a palette on it.

   The five functions call each other -- they share one palette lookup and one
   SVG wrapper -- so slicing a single one out and running it on its own no
   longer works. */
function ikonApi(win) {
	var nevek = ['ikonSzin', 'ikonSvg', 'szemIkon', 'stopIkon', 'modulIkon'];
	var kod = nevek.map(function (n) { return sliceFn(SZEM4_SRC, n); }).join('\n\n');
	return win.eval('(function () {\n' + kod +
		'\nreturn { szemIkon: szemIkon, stopIkon: stopIkon, modulIkon: modulIkon };\n})()');
}

/* A frame carrying the real stylesheet, so the icons read real tokens. */
function palettasKeret() {
	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; top:0; width:600px; height:200px;';
	document.body.appendChild(keret);
	var d = keret.contentDocument;
	d.open();
	d.write('<!doctype html><html><head><style>' + szemCss() + '</style></head><body></body></html>');
	d.close();
	return keret;
}

/* ------------------------------------------------------------------------ */
suite('The file itself', function () {
	ok(SZEM4_SRC.length > 100000, 'source loaded', SZEM4_SRC.length + ' chars');
	try { new Function(SZEM4_SRC); ok(true, 'parses as JavaScript'); }
	catch (e) { ok(false, 'parses as JavaScript', e.message); }

	var names = exportedNames();
	eq(names.slice().sort(), EXPECTED_EXPORTS.slice().sort(), 'exports exactly the expected names');
	ok(names.length === new Set(names).size, 'no name exported twice');
	ok(SZEM4_SRC.indexOf('Object.assign(window') < SZEM4_SRC.indexOf('function stop('),
	   'the export block comes first, so exports survive a failure further down');

	/* Empty catch blocks hide failures, so every one in the file has to say why
	   it is safe to ignore what it caught. The single exception is inside the
	   anti-bot code, which is kept byte-identical to upstream on purpose and so
	   cannot be commented. If this count moves, a new undocumented one arrived. */
	var bare = [];
	SZEM4_SRC.split('\n').forEach(function (line, i) {
		if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) bare.push((i + 1) + ': ' + line.trim());
	});
	ok(bare.length === 1 && bare[0].indexOf('botprotection_quest') !== -1,
	   'the only undocumented empty catch is the untouched anti-bot one',
	   bare.join('\n'));
});

/* ------------------------------------------------------------------------ */
/* ------------------------------------------------------------------------ */
/* codeOnly is what several wiring checks below stand on: they search a
   function's text for a call it must contain, and without this they cannot
   tell that call from a commented-out copy. So the stripper itself has to be
   held to it -- one that quietly returned its input would leave every one of
   those checks passing on nothing. */
suite('The comment stripper the wiring checks rest on', function () {
	eq(codeOnly('a();\n/* b(); */\nc();').indexOf('b()'), -1,
	   'a call inside a block comment is not code');
	eq(codeOnly('a(); // b();').indexOf('b()'), -1,
	   'nor is one after a line comment');
	ok(codeOnly('a();\n/* b(); */\nc();').indexOf('c()') !== -1,
	   'and the real calls around it survive');
	ok(codeOnly("open('http://x/y'); a();").indexOf('a()') !== -1,
	   'a URL in a string is not mistaken for a comment');
});

suite('Reading numbers off the game page', function () {
	var api = sandbox({}, [sliceFn(SZEM4_SRC, 'buildingCost')]);

	eq(api.buildingCost(buildRow({ wood: 90, stone: 80, iron: 70, pop: 5 })),
	   { wood: 90, stone: 80, iron: 70, pop: 5 }, 'plain costs');

	/* The game separates thousands with a dot, so "1.100" must not read as 1.
	   This bug has appeared twice in this file's history. */
	var big = buildRow({});
	big.cells[1].textContent = '1.100';
	big.cells[2].textContent = '12.345';
	big.cells[3].textContent = '1.234.567';
	eq(api.buildingCost(big).wood, 1100, 'a dotted thousand reads as 1100');
	eq(api.buildingCost(big).stone, 12345, 'five figures read correctly');
	eq(api.buildingCost(big).iron, 1234567, 'seven figures read correctly');

	/* A maxed building keeps its row but loses every cost cell. Reading zero
	   there is fine only because canAffordBuildNow refuses it on the button. */
	eq(api.buildingCost(buildRow({ maxed: true })), { wood: 0, stone: 0, iron: 0, pop: 0 },
	   'a maxed row costs nothing to read');

	var nf = sandbox({}, [sliceFn(SZEM4_SRC, 'numFrom')]);
	eq(nf.numFrom(fakeEl('1234')), 1234, 'an undotted number');
	throws(function () { nf.numFrom(null, 'kemek'); }, 'a missing element throws by name', 'kemek');
	throws(function () { nf.numFrom(fakeEl('semmi'), 'kemek'); }, 'text with no number throws by name', 'kemek');

	/* This used to be pinned the other way, as "KNOWN: numFrom stops at the
	   separator", while waiting for a saved page to say whether the game
	   really prints unit counts as "1.234".

	   That wait was the wrong call. Stripping the dot is a no-op on a number
	   that has none, and both callers read whole numbers -- units in a
	   village, spies available -- so there is no value the strip could
	   damage. Meanwhile the failure it guards against is silent and severe:
	   1234 units read as 1, feeding straight into what the farm decides to
	   send. Three other readers in this file already strip it. */
	eq(nf.numFrom(fakeEl('1.234')), 1234, 'a dotted thousand is read whole');
	eq(nf.numFrom(fakeEl('12.345.678')), 12345678, 'and so is a bigger one');
	eq(nf.numFrom(fakeEl('(1.234)')), 1234, 'the brackets the unit count comes wrapped in are ignored');
	eq(nf.numFrom(fakeEl('999')), 999, 'a number below the separator is untouched');
	eq(nf.numFrom(fakeEl('0')), 0, 'and so is zero');

	/* The first number still wins, as before -- this changes how a number is
	   read, not which one. */
	eq(nf.numFrom(fakeEl('1.234 / 2.000')), 1234, 'the first number is still the one taken');
});

/* ------------------------------------------------------------------------ */
suite('Build orders', function () {
	var api = sandbox({}, [
		sliceFn(SZEM4_SRC, 'splitBuildTarget'),
		sliceFn(SZEM4_SRC, 'parseBuildEntry'),
		sliceFn(SZEM4_SRC, 'buildCandidates')
	]);

	eq(api.parseBuildEntry('barracks 5'), { modifiers: [], parts: [['barracks', 5]] }, 'a plain entry');
	eq(api.parseBuildEntry('ANY(barracks 5, stable 5)'),
	   { modifiers: ['ANY'], parts: [['barracks', 5], ['stable', 5]] }, 'ANY over two buildings');
	eq(api.parseBuildEntry('ANY(MINES 25)'), { modifiers: ['ANY'], parts: [['MINES', 25]] }, 'ANY over the pits');
	eq(api.parseBuildEntry('ANY(FASTEST(MINES 25))'),
	   { modifiers: ['ANY', 'FASTEST'], parts: [['MINES', 25]] }, 'modifiers nest, outermost first');
	eq(api.parseBuildEntry('  main 20  ').parts, [['main', 20]], 'surrounding space is ignored');

	eq(api.buildCandidates([['barracks', 5]], { barracks: 3 }), ['barracks'], 'wanted, so a candidate');
	eq(api.buildCandidates([['barracks', 5]], { barracks: 5 }), [], 'already at the level, so not');
	eq(api.buildCandidates([['MINES', 25]], { wood: 20, stone: 18, iron: 22 }),
	   ['stone', 'wood', 'iron'], 'MINES offers the lowest pit first');
	eq(api.buildCandidates([['MINES', 25]], { wood: 10, stone: 10, iron: 10 }),
	   ['wood', 'stone', 'iron'], 'level pits keep wood, stone, iron order');
	eq(api.buildCandidates([['MINES', 20]], { wood: 20, stone: 18, iron: 22 }),
	   ['stone'], 'pits already at the level drop out');
	eq(api.buildCandidates([['barracks', 5], ['barracks', 9]], { barracks: 3 }),
	   ['barracks'], 'the same building is never offered twice');

	/* --- affordability, against a fake village and build screen --- */
	function ref(rows, village) {
		return {
			document: { getElementById: function (id) { return rows[id.replace('main_buildrow_', '')] || null; } },
			game_data: { village: village }
		};
	}
	var rich = { wood: 5000, stone: 5000, iron: 5000, storage_max: 20000, pop: 100, pop_max: 200 };
	var afford = sandbox({}, [
		sliceFn(SZEM4_SRC, 'buildingCost'),
		sliceFn(SZEM4_SRC, 'canAffordBuildNow')
	]);

	ok(afford.canAffordBuildNow(ref({ barracks: buildRow({ wood: 100, stone: 100, iron: 100 }) }, rich), 'barracks'),
	   'affordable');
	ok(!afford.canAffordBuildNow(ref({}, rich), 'barracks'), 'no row at all -- prerequisite missing');
	ok(!afford.canAffordBuildNow(ref({ barracks: buildRow({ wood: 99999 }) }, rich), 'barracks'),
	   'costs more wood than the village has');

	/* The trap that 8de1544 fixed: a finished building has no cost cells, so it
	   reads as free and would beat every real option. */
	ok(!afford.canAffordBuildNow(ref({ farm: buildRow({ maxed: true }) }, rich), 'farm'),
	   'a maxed building is never affordable, despite reading as free');
	ok(!afford.canAffordBuildNow(ref({ farm: buildRow({ wood: 10, noButton: true }) }, rich), 'farm'),
	   'no build button means it cannot be raised');
	ok(!afford.canAffordBuildNow(ref({ barracks: buildRow({ wood: 25000 }) }, rich), 'barracks'),
	   'more than the warehouse could ever hold');
	ok(!afford.canAffordBuildNow(ref({ barracks: buildRow({ wood: 10, pop: 500 }) }, rich), 'barracks'),
	   'more population than the farm can support');

	/* --- the modifiers themselves --- */
	var mod = sandbox({}, [
		sliceFn(SZEM4_SRC, 'buildingCost'),
		sliceFn(SZEM4_SRC, 'buildTimeOf'),
		sliceFn(SZEM4_SRC, 'canAffordBuildNow'),
		sliceFn(SZEM4_SRC, 'applyBuildModifier')
	]);

	eq(mod.buildTimeOf(ref({ a: buildRow({ time: '0:02:00' }) }, rich), 'a'), 120, 'H:MM:SS in seconds');
	eq(mod.buildTimeOf(ref({ a: buildRow({ time: '1:00:00' }) }, rich), 'a'), 3600, 'an hour');
	eq(mod.buildTimeOf(ref({ a: buildRow({ time: '2:03:04:05' }) }, rich), 'a'), 2 * 86400 + 3 * 3600 + 4 * 60 + 5,
	   'a day-long build still adds up');
	eq(mod.buildTimeOf(ref({ a: buildRow({ maxed: true }) }, rich), 'a'), Infinity, 'a maxed row sorts last, never first');

	var times = ref({
		wood: buildRow({ time: '0:10:00' }),
		stone: buildRow({ time: '0:02:00' }),
		iron: buildRow({ time: '0:05:00' })
	}, rich);
	eq(mod.applyBuildModifier('FASTEST', ['wood', 'stone', 'iron'], times),
	   ['stone', 'iron', 'wood'], 'FASTEST reorders by build time');

	var mixed = ref({
		wood: buildRow({ wood: 99999 }),
		stone: buildRow({ wood: 100 }),
		iron: buildRow({ wood: 200 })
	}, rich);
	eq(mod.applyBuildModifier('ANY', ['wood', 'stone', 'iron'], mixed),
	   ['stone', 'iron'], 'ANY drops what cannot be paid for');

	var broke = ref({ wood: buildRow({ wood: 99999 }), stone: buildRow({ wood: 99999 }) }, rich);
	eq(mod.applyBuildModifier('ANY', ['wood', 'stone'], broke), ['wood', 'stone'],
	   'ANY with nothing affordable keeps the list, so the builder cannot stall in a new way');
	eq(mod.applyBuildModifier('WHAT', ['wood'], mixed), ['wood'], 'an unknown modifier changes nothing');
});

/* ------------------------------------------------------------------------ */
suite('Farm distance', function () {
	var world = { SZEM4_FARM: { DOMINFO_FROM: {} } };
	var api = sandbox(world, [sliceFn(SZEM4_SRC, 'distCalc'), sliceFn(SZEM4_SRC, 'farmDistance')]);

	eq(api.distCalc(['500', '500'], ['503', '504']), 5, 'a 3-4-5 triangle');
	eq(api.farmDistance('500|500'), null, 'no attacking village yet, so no distance');

	world.SZEM4_FARM.DOMINFO_FROM = { '503|504': {}, '500|501': {}, '600|600': {} };
	eq(api.farmDistance('500|500'), 1, 'the nearest attacker wins, not the first');
	eq(api.farmDistance('600|600'), 0, 'a village farming itself is zero away');
});

/* ------------------------------------------------------------------------ */
suite('Giving the troops back when an attack is called off', function () {
	function village(counts) {
		return { isUnits: {}, noOfUnits: JSON.parse(JSON.stringify(counts)) };
	}
	function count(text, needle) { return text.split(needle).length - 1; }
	var forras = stripComments(SZEM4_SRC);

	var api = sandbox({}, [sliceFrom(SZEM4_SRC, 'var UNITS_UNKNOWN', 'resetAvailableUnits')],
	                  { UNITS_UNKNOWN: 'UNITS_UNKNOWN' });

	var v = village({ spear: 40, sword: 0, axe: 7 });
	api.resetAvailableUnits(v);
	eq(v.noOfUnits, { spear: 999, sword: 999, axe: 999 },
	   'every count goes back to not-counted-yet');
	eq(api.UNITS_UNKNOWN(), 999, 'which is the value a village starts life with');

	/* Both callers return "ERROR" on the very next line, and both sit inside a
	   catch that swallows quietly. A throw here would skip that return and let
	   step 3 carry on against a page that is already being replaced. */
	api.resetAvailableUnits(undefined);
	api.resetAvailableUnits({});
	ok(true, 'a village that is not there is ignored rather than thrown at');

	/* The old behaviour on this path, reproduced. It asked updateAvailableUnits
	   to re-read the counts treating nothing as sent -- but that reads the
	   rally point's unit picker, and the page SZEM stands on when an attack is
	   refused is the confirmation screen, which has no unit picker. It threw on
	   the first unit and gave nothing back. This is his 2026-09-07 11:00:48
	   log line, written as a test. */
	var logged = [];
	var oldal = {
		location: { href: 'https://hu103.klanhaboru.hu/game.php?village=1115&screen=place&try=confirm' },
		querySelector: function () { return null; }
	};
	var ablak = { document: oldal };
	var upd = sandbox({
		UNITS: ['spear', 'sword'],
		FARM_REF: ablak,
		FARM_LEPES: 2,
		console: { error: function () {} },
		debug: function (a, b) { logged.push(a + ': ' + b); }
	}, [sliceFn(SZEM4_SRC, 'pageUrl'), sliceFn(SZEM4_SRC, 'numFrom'),
	    sliceFn(SZEM4_SRC, 'gameEl'), sliceFn(SZEM4_SRC, 'gameNum'),
	    sliceFn(SZEM4_SRC, 'updateAvailableUnits')]);

	var stale = village({ spear: 40, sword: 0 });
	upd.updateAvailableUnits(stale);
	eq(stale.noOfUnits, { spear: 40, sword: 0 },
	   'reading the confirmation screen gives nothing back at all');
	eq(logged.length, 1, 'it logs the failure instead, once per attempt');
	ok((logged[0] || '').indexOf('#units_entry_all_spear') > -1,
	   'naming the element the confirmation screen does not have', logged[0]);
	ok((logged[0] || '').indexOf('try=confirm') > -1,
	   'and naming the page it was looking at', logged[0]);

	/* So the called-off paths must not reach for that page at all. */
	var step3 = sliceFn(forras, 'szem4_farmolo_3egyeztet');
	eq(count(step3, 'resetAvailableUnits('), 2, 'both called-off paths give the troops back');
	eq(count(step3, 'updateAvailableUnits('), 0, 'and neither one reads the confirmation screen');

	/* updateAvailableUnits still does its own job on the page that does have a
	   picker: record what is left once the attack goes out. */
	ablak.document = {
		location: { href: 'https://hu103.klanhaboru.hu/game.php?village=1115&screen=place' },
		querySelector: function (sel) {
			if (sel === '#units_entry_all_spear') return { textContent: '(1.234)' };
			if (sel === '#units_entry_all_sword') return { textContent: '(50)' };
			if (sel === '#unit_input_spear') return { value: '30' };
			if (sel === '#unit_input_sword') return { value: '' };
			return null;
		}
	};
	var live = village({ spear: 0, sword: 0 });
	upd.updateAvailableUnits(live);
	eq(live.noOfUnits, { spear: 1204, sword: 50 },
	   'what is left after the attack goes out, thousands separator and all');
	eq(logged.length, 1, 'and nothing new is logged');

	/* Written once, so the round reset, a village's first moment and the
	   called-off path cannot drift apart. */
	eq(count(forras, '= 999'), 1, 'the sentinel has exactly one home');
	eq(count(forras, 'resetAvailableUnits('), 4,
	   'its definition, the round reset, and the two called-off paths');
});

/* ------------------------------------------------------------------------ */
suite('Deleting a whole tableful of villages at once', function () {
	/* Real tables in the real document. The bug was that the bulk pass looked
	   every row up in the farm-target list, so the attacking-villages table
	   threw on its very first row -- and threw into a catch that only reaches
	   the browser console, so the one row you clicked vanished and the rest
	   silently did not. A fake table could not show that. */
	function tablak() {
		var wrap = document.createElement('div');
		wrap.style.display = 'none';
		var ures = '<td></td><td></td><td></td><td></td><td></td><td></td>';
		wrap.innerHTML =
			'<input type="checkbox" id="farm_multi_hova">' +
			'<input type="checkbox" id="farm_multi_honnan">' +
			'<table id="farm_hova"><tr><th>Hova</th></tr>' +
			'<tr><td>500|500</td>' + ures + '</tr>' +
			'<tr><td>501|501</td>' + ures + '</tr>' +
			'<tr><td>502|502</td>' + ures + '</tr></table>' +
			'<table id="farm_honnan"><tr><th>Honnan</th></tr>' +
			'<tr><td>600|600</td></tr>' +
			'<tr><td>601|601</td></tr>' +
			'<tr><td>602|602</td></tr></table>';
		document.body.appendChild(wrap);
		return wrap;
	}
	function allapot() {
		return {
			SZEM4_FARM: {
				DOMINFO_FARMS: { '500|500': { szin: {} }, '501|501': { szin: {} }, '502|502': { szin: {} } },
				DOMINFO_FROM: { '600|600': {}, '601|601': {}, '602|602': {} }
			},
			JELZO_NINCS: ''
		};
	}
	function api(world) {
		return sandbox(world, [sliceFn(SZEM4_SRC, 'distCalc'), sliceFn(SZEM4_SRC, 'farmDistance'),
		                       sliceFn(SZEM4_SRC, 'refreshFarmDistances'),
		                       sliceFn(SZEM4_SRC, 'multipricer'), sliceFn(SZEM4_SRC, 'sortorol')]);
	}
	function elsoCella(tabla) { return document.querySelectorAll('#' + tabla + ' tr')[1].cells[0]; }
	function koordok(tabla) {
		return [].slice.call(document.querySelectorAll('#' + tabla + ' tr')).slice(1)
			.map(function (r) { return r.cells[0].textContent; }).join(',');
	}

	/* One row at a time, the box unticked -- this always worked. */
	var wrap = tablak(), w = allapot();
	api(w).sortorol(elsoCella('farm_honnan'), 'honnan');
	eq(koordok('farm_honnan'), '601|601,602|602', 'a single attacking village goes');
	eq(Object.keys(w.SZEM4_FARM.DOMINFO_FROM).join(','), '601|601,602|602',
	   'and stops being one SZEM farms from');
	wrap.remove();

	/* The whole visible table, box ticked. This is the one that threw. */
	wrap = tablak(); w = allapot();
	document.getElementById('farm_multi_honnan').checked = true;
	document.querySelectorAll('#farm_hova tr')[1].cells[6].innerHTML = '9.9';
	api(w).sortorol(elsoCella('farm_honnan'), 'honnan');
	eq(koordok('farm_honnan'), '', 'every visible attacking village goes');
	eq(Object.keys(w.SZEM4_FARM.DOMINFO_FROM).length, 0, 'and none is left behind in the data');
	/* Tav is measured to the nearest attacking village, so deleting them in
	   bulk invalidates the whole column. sortorol refreshes it after removing
	   its own row, which is too early -- the bulk pass has not run yet. */
	eq(document.querySelectorAll('#farm_hova tr')[1].cells[6].innerHTML, '',
	   'and the distances measured from them are cleared, not left stale');
	wrap.remove();

	/* "Visible" is the whole point of filtering first: the search hides rows
	   rather than removing them, so a hidden one must survive. */
	wrap = tablak(); w = allapot();
	document.getElementById('farm_multi_honnan').checked = true;
	document.querySelectorAll('#farm_honnan tr')[2].style.display = 'none';
	api(w).sortorol(elsoCella('farm_honnan'), 'honnan');
	eq(koordok('farm_honnan'), '601|601', 'a filtered-out village is left alone');
	eq(Object.keys(w.SZEM4_FARM.DOMINFO_FROM).join(','), '601|601', 'in the data as well as on screen');
	wrap.remove();

	/* The farm-target table has always worked and must keep working. */
	wrap = tablak(); w = allapot();
	document.getElementById('farm_multi_hova').checked = true;
	api(w).sortorol(elsoCella('farm_hova'), 'hova');
	eq(koordok('farm_hova'), '', 'every visible farm target goes');
	eq(Object.keys(w.SZEM4_FARM.DOMINFO_FARMS).length, 0, 'and none is left behind in the data');
	eq(koordok('farm_honnan'), '600|600,601|601,602|602', 'while the other table is untouched');
	wrap.remove();
});


/* ------------------------------------------------------------------------ */
suite('VIJE resting with the farm', function () {
	function vijeWorld(optionOn, until, now) {
		return {
			VIJE_SYNC_REST_UNTIL: until,
			VIJE_PAUSE: false,
			Date: { now: function () { return now; } },
			document: {
				getElementById: function (id) {
					if (id !== 'vije_opts') return null;
					if (optionOn === 'missing') throw new Error('no interface');
					return { pihensync: { checked: optionOn } };
				},
				addEventListener: function (name, fn) { this._handler = fn; }
			},
			debug: function () {}
		};
	}
	function resting(w) { return sandbox(w, [sliceFn(SZEM4_SRC, 'isVijeSyncResting')]).isVijeSyncResting(); }

	ok(resting(vijeWorld(true, 2000, 1000)) === true, 'deadline ahead and the option on');
	ok(resting(vijeWorld(false, 2000, 1000)) === false, 'unticking wakes it now, not at the end of the rest');
	ok(resting(vijeWorld(true, 500, 1000)) === false, 'deadline passed');
	ok(resting(vijeWorld(true, undefined, 1000)) === false, 'no deadline set reads as not resting');
	ok(resting(vijeWorld('missing', 2000, 1000)) === false, 'no interface yet reads as not resting');

	/* The head start itself, taken from the real listener rather than restated. */
	var elore = Number(/VIJE_SYNC_ELORE_MS\s*=\s*(\d+)/.exec(SZEM4_SRC)[1]);
	eq(elore, 120000, 'VIJE wakes two minutes before the farm');

	function armWith(restMs, optionOn, paused) {
		var w = vijeWorld(optionOn === undefined ? true : optionOn, 0, 1000000);
		w.VIJE_PAUSE = !!paused;
		w.VIJE_SYNC_ELORE_MS = elore;
		sandbox(w, [sliceListener(SZEM4_SRC, 'farm_pihen')]);
		w.document._handler({ detail: { restMs: restMs } });
		// left at its starting 0 means the listener declined to arm a rest
		return w.VIJE_SYNC_REST_UNTIL === 0 ? 'untouched' : w.VIJE_SYNC_REST_UNTIL - 1000000;
	}
	eq(armWith(600000), 480000, 'a 10 minute rest gives VIJE 8 minutes');
	eq(armWith(120000), 60000, 'a 2 minute rest is capped at half, not zero');
	eq(armWith(60000), 30000, 'the head start never outruns the rest itself');
	eq(armWith(600000, false), 'untouched', 'nothing happens with the option off');
	eq(armWith(600000, true, true), 'untouched', 'a hand-stopped VIJE is left stopped');
	eq(armWith(0), 'untouched', 'a nonsense rest length is ignored');

	ok(SZEM4_SRC.match(/sendCustomEvent\('farm_pihen'/g).length === 1,
	   'the farm announces its rest in exactly one place');
});

/* ------------------------------------------------------------------------ */
suite('Not overwriting good data with bad', function () {
	function storeWorld() {
		var store = {};
		return {
			store: store,
			localStorage: {
				getItem: function (k) { return k in store ? store[k] : null; },
				setItem: function (k, v) { store[k] = v; }
			},
			naplo: function (a, b) { this.logged = b; }
		};
	}
	var w = storeWorld();
	var api = sandbox(w, [sliceFn(SZEM4_SRC, 'storeGuarded')]);
	var big = new Array(1001).join('x');   // 1000 characters

	ok(api.storeGuarded('k', big, 'Farm') === true, 'first save goes through');
	ok(api.storeGuarded('k', 'tiny', 'Farm') === false, 'a save that collapses to a fraction is refused');
	eq(w.store.k.length, 1000, 'and the good data is still there');
	ok(String(w.logged).indexOf('Farm') !== -1, 'the refusal is logged by name');
	ok(api.storeGuarded('k', new Array(600).join('y'), 'Farm') === true,
	   'a merely smaller save is allowed -- data does shrink legitimately');
	ok(api.storeGuarded('short', 'a', 'Farm') === true, 'nothing stored yet, so nothing to protect');
});

/* ------------------------------------------------------------------------ */
/* The pause machinery, including the global timed pause. */

function pauseWorld() {
	var w = {
		FARM_PAUSE: true, VIJE_PAUSE: true, EPIT_PAUSE: true, ADAT_PAUSE: false, GYUJTO_PAUSE: true,
		BEF_PAUSE: true,
		VIJE_SYNC_REST_UNTIL: 0,
		ALL_EXTENSION: ['farm', 'vije', 'idtamad', 'epit', 'gyujto', 'adatok', 'bef'],
		clock: 1000000000000,
		calls: [], alerts: [], logged: [], prompts: [], confirms: [],
		answers: [], confirmAnswer: true, ticker: null, tickMs: 0,
		img: { src: '', alt: '', title: '' },
		link: { title: '' },
		/* The button is drawn from the palette now; these suites only care
		   that the right state reaches it. */
		modulIkon: function (szunetel) { return szunetel ? 'IKON:all' : 'IKON:fut'; },
		label: { textContent: '', title: '' }
	};
	w.Date = { now: function () { return w.clock; } };
	w.pic = function (f) { return 'PIC:' + f; };
	w.shorttest = function () { w.calls.push('shorttest'); return true; };
	w.alert2 = function (m) { w.alerts.push(m); };
	w.naplo = function (k, s) { w.logged.push(s); };
	w.debug = function (k, s) { w.logged.push('DEBUG ' + s); };
	w.prompt = function (m, d) { w.prompts.push(m); return w.answers.length ? w.answers.shift() : d; };
	w.confirm = function (m) { w.confirms.push(m); return w.confirmAnswer; };
	w.setInterval = function (fn, ms) { w.ticker = fn; w.tickMs = ms; return 77; };
	w.clearInterval = function (id) { w.calls.push('clearInterval:' + id); w.ticker = null; };
	w.document = {
		querySelector: function (sel) { w.calls.push('lookup:' + sel); return w.img; },
		/* The countdown lives in its own span now: the link carries the stop
		   sign, and writing over the link would take the icon with it. */
		getElementById: function (id) {
			if (id === 'szunet_mind') return w.link;
			if (id === 'szunet_mind_ido') return w.label;
			return null;
		}
	};
	return w;
}

function pauseApi(w) {
	return sandbox(w, [
		sliceFn(SZEM4_SRC, 'moduleIsPaused'),
		sliceFn(SZEM4_SRC, 'setModulePause'),
		sliceFn(SZEM4_SRC, 'szunet'),
		sliceFrom(SZEM4_SRC, 'var SZUNET_MIND_VEGE', 'szunetMind')
	], { vege: 'SZUNET_MIND_VEGE', vissza: 'SZUNET_MIND_VISSZA.slice()' });
}

/* Which modules are actually running, by their own flags. */
function running(w) {
	var flags = { farm: w.FARM_PAUSE, vije: w.VIJE_PAUSE, epit: w.EPIT_PAUSE, gyujto: w.GYUJTO_PAUSE, adatok: w.ADAT_PAUSE, bef: w.BEF_PAUSE };
	return Object.keys(flags).filter(function (k) { return flags[k] === false; }).sort();
}

function tick(w, ms) { w.clock += ms; if (w.ticker) w.ticker(); }

suite('Pausing one module', function () {
	var w = pauseWorld(), api = pauseApi(w);

	/* Without this the rest of the suite could pass while testing nothing: if
	   the sandbox could not see a flag being written, every before/after
	   comparison would look identical no matter what the code did. */
	api.szunet('farm', w.img);
	ok(w.FARM_PAUSE === false, 'the sandbox really observes flag writes');
	ok(w.img.src === 'IKON:fut' && w.img.alt === 'Stop', 'the icon reports it is running');
	api.szunet('farm', w.img);
	ok(w.FARM_PAUSE === true && w.img.src === 'IKON:all', 'and toggles back');
	ok(w.calls.filter(function (c) { return c === 'shorttest'; }).length === 2,
	   'the farm re-checks its settings either way');

	w = pauseWorld(); api = pauseApi(w);
	w.VIJE_SYNC_REST_UNTIL = 999;
	api.szunet('vije', w.img);
	eq(w.VIJE_SYNC_REST_UNTIL, 0, 'starting VIJE by hand beats a synced rest');
	w.VIJE_SYNC_REST_UNTIL = 999;
	api.szunet('vije', w.img);
	eq(w.VIJE_SYNC_REST_UNTIL, 999, 'stopping it leaves the rest alone');

	w = pauseWorld(); api = pauseApi(w);
	api.szunet('idtamad', w.img);
	ok(w.alerts.length === 1, 'the attack watcher explains it has nothing to pause');
	api.szunet('nincsilyen', w.img);
	ok(w.alerts.length === 2, 'an unknown module says so rather than failing quietly');

	/* Setting rather than toggling is what the global pause needs. */
	w = pauseWorld(); api = pauseApi(w);
	w.FARM_PAUSE = false;
	ok(api.setModulePause('farm', true) === true, 'sets a real module');
	ok(w.FARM_PAUSE === true, 'to the state asked for, not the opposite of the current one');
	ok(api.setModulePause('farm', true) === true && w.FARM_PAUSE === true, 'setting twice is harmless');
	ok(w.calls.some(function (c) { return c === 'lookup:#kiegs img[name="farm"]'; }),
	   'finds the icon itself when not handed one');
	ok(api.setModulePause('idtamad', true) === false, 'refuses a module with no pause of its own');
});

suite('Pausing everything for a while', function () {
	var w = pauseWorld(), api = pauseApi(w);
	w.FARM_PAUSE = false; w.VIJE_PAUSE = false; w.GYUJTO_PAUSE = false;  // running
	w.EPIT_PAUSE = true;                                                 // stopped by hand earlier
	w.ADAT_PAUSE = false;                                                // saving is on
	w.answers = ['30'];
	var start = w.clock;
	api.szunetMind();

	eq(api.vissza(), ['farm', 'vije', 'gyujto'], 'records what was running, in menu order');
	eq(running(w), ['adatok'], 'stops those and leaves saving alone');
	eq(api.vege(), start + 30 * 60000, 'the deadline is 30 minutes out');
	eq(w.label.textContent, '30:00', 'the countdown appears beside the stop sign');
	eq(w.tickMs, 1000, 'and counts once a second');

	tick(w, 29 * 60000);
	eq(w.label.textContent, '1:00', 'the countdown counts down');
	eq(running(w), ['adatok'], 'still stopped');
	tick(w, 59000);
	eq(running(w), ['adatok'], 'not a second early');
	tick(w, 1000);
	eq(running(w), ['adatok', 'farm', 'gyujto', 'vije'], 'everything recorded restarts on time');
	ok(w.EPIT_PAUSE === true, 'what was already stopped stays stopped');
	eq(w.label.textContent, '', 'the link goes back to normal');
	eq(api.vege(), 0, 'and the pause is over');
	ok(w.calls.some(function (c) { return c === 'clearInterval:77'; }), 'the timer is cleared, not left running');

	/* A background tab can have its timers throttled to once a minute, so the
	   tick that ends the pause may arrive very late. It still has to restart. */
	w = pauseWorld(); api = pauseApi(w);
	w.FARM_PAUSE = false; w.answers = ['10'];
	api.szunetMind();
	tick(w, 45 * 60000);
	ok(w.FARM_PAUSE === false, 'a very late tick still restarts everything');
	ok(w.ticker === null, 'and stops ticking afterwards');

	/* Starting something by hand mid-pause must not be undone at the end. The
	   telling case is a module that IS on the restore list: resuming by
	   toggling rather than by setting would stop it again, which is precisely
	   the wrong way round. A module never recorded cannot show that up, so it
	   is tested here alongside one that was. */
	w = pauseWorld(); api = pauseApi(w);
	w.FARM_PAUSE = false; w.VIJE_PAUSE = false; w.answers = ['5'];
	api.szunetMind();
	eq(api.vissza(), ['farm', 'vije'], 'both were recorded');
	api.setModulePause('farm', false);    // he restarts the farm early, by hand
	api.setModulePause('epit', false);    // and starts the builder, never recorded
	tick(w, 5 * 60000);
	ok(w.FARM_PAUSE === false, 'a recorded module restarted by hand is not stopped again');
	ok(w.EPIT_PAUSE === false, 'a module started during the pause is left running');
	ok(w.VIJE_PAUSE === false, 'and the rest still come back');

	/* Clicking the countdown offers to finish early. */
	w = pauseWorld(); api = pauseApi(w);
	w.FARM_PAUSE = false; w.VIJE_PAUSE = false; w.answers = ['60'];
	api.szunetMind();
	w.confirmAnswer = false;
	api.szunetMind();
	ok(w.confirms.length === 1 && api.vege() !== 0, 'declining leaves it paused');
	ok(w.FARM_PAUSE === true, 'and everything stays stopped');
	w.confirmAnswer = true;
	api.szunetMind();
	eq(api.vege(), 0, 'accepting ends it');
	eq(running(w), ['adatok', 'farm', 'vije'], 'and restarts what it stopped');
	ok(w.prompts.length === 1, 'it never asks for minutes twice');

	/* Refusals. */
	w = pauseWorld(); api = pauseApi(w);
	api.szunetMind();
	ok(api.vege() === 0 && w.alerts.length === 1, 'says so when nothing is running');
	ok(w.prompts.length === 0, 'and does not bother asking');

	[['abc', 'text'], ['0', 'zero'], ['-5', 'a negative'], ['9999', 'over the day cap']].forEach(function (pair) {
		var x = pauseWorld(), a = pauseApi(x);
		x.FARM_PAUSE = false; x.answers = [pair[0]];
		a.szunetMind();
		ok(a.vege() === 0 && x.FARM_PAUSE === false, 'rejects ' + pair[1] + ' and stays running');
		ok(x.alerts.length === 1, 'and explains why for ' + pair[1]);
	});

	w = pauseWorld(); api = pauseApi(w);
	w.FARM_PAUSE = false; w.answers = [null];
	api.szunetMind();
	ok(api.vege() === 0 && w.FARM_PAUSE === false && w.alerts.length === 0, 'cancelling the box does nothing at all');

	/* The two deliberate exclusions. */
	w = pauseWorld(); api = pauseApi(w);
	w.FARM_PAUSE = false; w.ADAT_PAUSE = false; w.answers = ['15'];
	api.szunetMind();
	ok(w.ADAT_PAUSE === false, 'data saving keeps running while you are away');
	ok(api.vissza().indexOf('adatok') === -1 && api.vissza().indexOf('idtamad') === -1,
	   'and the excluded modules are never recorded');
});

/* ------------------------------------------------------------------------ */
/* The bot-protection alarm. When the game asks for a human, every module has
   to stop and stay stopped until the code is typed in -- so what matters most
   is that the alarm can be raised once, and can actually be switched off. */
suite('The bot-protection alarm', function () {
	/* A window whose navigations can be told apart from a reload: assigning to
	   location.href is a fresh GET, location.reload() repeats the last request. */
	function fakeAblak(href, page) {
		var a = { closed: false, navigated: [], reloads: 0, page: page || {} };
		a.document = {
			get title() { return a.page.title || ''; },
			getElementById: function (id) { return a.page[id] || null; },
			querySelector: function (sel) { return a.page[sel] || null; }
		};
		a.location = {
			get href() { return href; },
			set href(v) { a.navigated.push(v); },
			reload: function () { a.reloads++; }
		};
		return a;
	}
	function alarmWorld(pageState) {
		var w = {
			BOT: false, BOTORA: 0, ALTBOT2: false, BOT_VOL: 0.0, BOT_REF: null,
			VILL1ST: 'https://game/village',
			SZEM4_SETTINGS: { altbot: false },
			timers: {}, nextTimer: 1, fired: [], alerts: [], sounds: [], logged: [],
			page: pageState || {}, clock: new Date('2026-09-06T14:00:00').getTime()
		};
		var RealDate = Date;
		w.Date = function (t) { return new RealDate(t); };
		w.Date.now = function () { return w.clock; };
		/* Timers that can be inspected: a cancelled one disappears, an orphan
		   left behind by the old code would still be here to run. */
		w.setTimeout = function (fn, ms) { var id = w.nextTimer++; w.timers[id] = fn; return id; };
		w.clearTimeout = function (id) { delete w.timers[id]; };
		w.liveTimers = function () { return Object.keys(w.timers); };
		w.runPending = function () {
			var ids = Object.keys(w.timers);
			ids.forEach(function (id) { var fn = w.timers[id]; delete w.timers[id]; w.fired.push(id); fn(); });
			return ids.length;
		};
		var doc = {
			get title() { return w.page.title || ''; },
			getElementById: function (id) { return w.page[id] || null; },
			querySelector: function (sel) { return w.page[sel] || null; }
		};
		/* Kept aside: BotvedelemKi() can close this window and the tick opens a
		   new one, so window.open has to keep handing back something usable. */
		w.botAblak = fakeAblak('https://game/bot');
		w.botAblak.document = doc;
		w.botAblak.close = function () { this.closed = true; };
		w.BOT_REF = w.botAblak;
		/* The module windows, as nyitottAblakok() sees them: one open, one open
		   but never used, one never opened, one already closed, and one that
		   throws the moment it is asked whether it is closed. */
		w.FARM_REF = fakeAblak('https://game/game.php?screen=place&try=confirm');
		w.VIJE_REF1 = fakeAblak('https://game/game.php?screen=report');
		w.VIJE_REF2 = null;
		w.EPIT_REF = fakeAblak('https://game/game.php?screen=main');
		w.EPIT_REF.closed = true;
		w.GYUJTO_REF = { get closed() { throw new Error('elt\u00fbnt'); } };
		w.BEF_REF = null;
		w.window = { open: function () { w.botAblak.closed = false; return w.botAblak; } };
		/* One element, not a fresh stub per call: the question is whether
		   anything ever actually paused the clip. */
		w.audio = { volume: 0, paused: true, pauses: 0,
		            pause: function () { this.paused = true; this.pauses++; } };
		w.document = { getElementById: function (id) { return id === 'audio1' ? w.audio : null; } };
		/* Which modules are running, as the sweep asks it. */
		w.ALL_EXTENSION = ['farm', 'vije', 'epit', 'gyujto', 'adatok'];
		w.futo = ['farm'];
		w.szunetMindFut = function (id) { return w.futo.indexOf(id) !== -1; };
		w.soundVolume = function (v) { w.sounds.push(v); w.audio.volume = v; };
		w.playSound = function () { w.audio.paused = false; };   // the clip is now running
		w.alert2 = function (m) { w.alerts.push(m); };
		w.debug = function () {};
		w.naplo = function (k, m) { w.logged.push(k + ': ' + m); };
		return w;
	}
	/* The whole block, declarations included -- BOT_KEZDET and friends are
	   top-level vars, and the functions cannot run without them. They are local
	   to the sandbox once sliced, so they are read back through accessors
	   rather than off the fake world. */
	function alarmApi(w) {
		return sandbox(w, [sliceFn(SZEM4_SRC, 'stopSound'),
		                   sliceFrom(SZEM4_SRC, 'var BOT_HATARIDO_MS', 'botvedelemFolytatas')],
			{ kezdet: 'BOT_KEZDET', feladva: 'BOT_FELADVA', hatarido: 'BOT_HATARIDO_MS',
			  botora: 'BOTORA', botref: 'BOT_REF', hangero: 'BOT_HANGERO',
			  ellenorzes: 'BOT_ELLENORZES', ellenorzesMs: 'BOT_ELLENORZES_MS' });
	}
	/* Poll the alarm forward by `ms`, in the 2.5s steps it really uses. */
	function pollFor(w, ms) {
		var step = 2500;
		for (var t = 0; t < ms; t += step) {
			w.clock += step;
			if (!w.runPending()) return;   // the cycle stopped on its own
		}
	}

	/* A check is showing: serverTime has loaded, and bot_check is present. */
	function checkShowing() {
		return { '#serverTime': { innerHTML: '12:34:56' }, 'bot_check': {}, '#bot_check': {} };
	}
	/* The page once the check really is gone. Resuming now depends on SZEM
	   reading this, so every test that resumes has to put it there. */
	function tiszta() {
		return { '#serverTime': { innerHTML: '12:34:56' } };
	}

	var w = alarmWorld(checkShowing()), api = alarmApi(w);
	api.BotvedelemBe();
	ok(w.BOT === true, 'raising the alarm stops every module');
	eq(w.liveTimers().length, 1, 'and starts exactly one polling cycle');

	/* isPageLoaded() calls this afresh on every failed page check. Each call
	   used to start another chain that could never be cancelled. */
	api.BotvedelemBe();
	api.BotvedelemBe();
	api.BotvedelemBe();
	eq(w.liveTimers().length, 1, 'raising it again does not start a second cycle');

	w.runPending();
	eq(w.liveTimers().length, 1, 'the cycle reschedules itself, still just one');
	w.runPending(); w.runPending();
	eq(w.liveTimers().length, 1, 'and stays one over several polls');

	/* Switching it off has to leave nothing running. */
	ok(w.audio.paused === false, 'the alarm is making noise while it waits');
	w.page = tiszta();   // he really did solve it, and the page shows it
	api.BotvedelemKi();
	ok(w.BOT === false, 'typing the code lets the modules run again');
	ok(w.audio.paused === true, 'and the alarm sound stops');
	ok(w.audio.pauses > 0,
	   'because something calls pause() -- naming it without the brackets does nothing');
	eq(w.liveTimers().length, 0, 'no polling cycle is left behind');
	eq(api.botora(), 0, 'and the handle is cleared, not just the timer');

	/* The bug this replaced: an orphaned cycle kept setting BOT = true after
	   the code had been typed in, freezing every module for good. */
	eq(w.runPending(), 0, 'nothing is left that could re-freeze the modules');
	ok(w.BOT === false, 'so the modules stay running');

	/* And the alarm must still work the next time. A stale non-zero handle
	   would make it think a cycle was already polling and refuse. */
	w.page = checkShowing();   // a fresh check
	api.BotvedelemBe();
	ok(w.BOT === true, 'a later check raises the alarm again');
	eq(w.liveTimers().length, 1, 'with a fresh cycle');

	/* Switching off must not depend on the window still being open. */
	var w2 = alarmWorld(checkShowing()), api2 = alarmApi(w2);
	api2.BotvedelemBe();
	w2.page = tiszta();
	w2.BOT_REF.close = function () { throw new Error('already gone'); };
	try { api2.BotvedelemKi(); } catch (e) { /* the throw itself is a separate bug */ }
	eq(w2.liveTimers().length, 0, 'the cycle is cancelled even when the cleanup below it fails');
	eq(api2.botora(), 0, 'and the handle with it');

	ok(SZEM4_SRC.indexOf('setTimeout("BotvedelemBe()"') === -1,
	   'the alarm no longer reschedules itself through a string');

	/* --- standing down when nobody answers --- */
	var w3 = alarmWorld(checkShowing()), api3 = alarmApi(w3);
	eq(api3.hatarido(), 180000, 'the alarm gives up after three minutes');

	api3.BotvedelemBe();
	eq(api3.kezdet(), w3.clock, 'it remembers when the check appeared');
	pollFor(w3, 2 * 60000);
	eq(w3.liveTimers().length, 1, 'still calling for you two minutes in');
	ok(w3.BOT === true, 'and everything is still halted');
	ok(api3.feladva() === false, 'it has not given up yet');

	pollFor(w3, 90000);
	eq(w3.liveTimers().length, 0, 'past three minutes it stops calling');
	ok(api3.feladva() === true, 'and records that it gave up');
	ok(w3.sounds[w3.sounds.length - 1] === 0.0, 'the alarm goes quiet');
	ok(w3.audio.paused === true, 'with the clip stopped, not merely turned down');
	ok(api3.botref() === null, 'the window it opened is let go');

	/* The point of the whole thing: giving up on being answered must never
	   mean carrying on. The check is still there and still unanswered. */
	ok(w3.BOT === true, 'every module STAYS halted after it gives up');
	eq(w3.runPending(), 0, 'and nothing is left running that could change that');
	ok(w3.BOT === true, 'still halted');

	ok(w3.logged.some(function (l) { return l.indexOf('perce nincs') !== -1; }),
	   'it says so in the log', w3.logged.join(' | '));
	ok(w3.alerts[w3.alerts.length - 1].indexOf('BotvedelemKi') !== -1,
	   'and leaves you a way to resume when you get back');

	/* Coming back after it gave up. This is the path where BOT_REF is already
	   null, which used to throw before anything else could run. */
	w3.clock += 40 * 60000;
	w3.page = tiszta();
	api3.BotvedelemKi();
	/* The stand-down let the window go, so there is nothing to read yet:
	   one has to be opened and loaded before anything can be confirmed. */
	pollFor(w3, 10000);
	ok(w3.BOT === false, 'resuming after a stand-down works');
	eq(api3.kezdet(), 0, 'and the alarm is fully reset');
	ok(api3.feladva() === false, 'including the gave-up flag');
	ok(w3.sounds[w3.sounds.length - 1] === 1.0,
	   'sound is turned back up, or every later alarm would be silent');
	ok(w3.audio.paused === true, 'and nothing is left playing to come back with it');

	/* --- what you missed --- */
	var report = w3.logged.filter(function (l) { return l.indexOf('Feloldva') !== -1; })[0] || '';
	ok(report !== '', 'coming back gives you a report', w3.logged.join(' | '));
	/* Locale-agnostic: toLocaleTimeString gives 14:00:00 here and 2:00:00 PM on
	   an English machine, so match the shape rather than one rendering. */
	ok(/\b\d{1,2}:00:00/.test(report), 'saying when the check appeared', report);
	ok(/\b4[0-9] percig/.test(report), 'and roughly how long everything stood', report);
	ok(report.indexOf('elhallgatott') !== -1, 'and that the alarm had given up', report);

	/* Answered in time: same report, without the gave-up wording. */
	var w4 = alarmWorld(checkShowing()), api4 = alarmApi(w4);
	api4.BotvedelemBe();
	pollFor(w4, 60000);
	w4.page = tiszta();
	api4.BotvedelemKi();
	var r4 = w4.logged.filter(function (l) { return l.indexOf('Feloldva') !== -1; })[0] || '';
	ok(r4 !== '', 'answering in time is reported too');
	ok(r4.indexOf('elhallgatott') === -1, 'without claiming the alarm gave up', r4);
	ok(w4.BOT === false, 'and the modules run again');

	/* --- the windows SZEM has open ---
	   Found by name. The old walk over `window` for properties containing
	   "REF" stopped finding anything when the file was wrapped in an IIFE,
	   which made the refresh below a no-op without ever failing. */
	var w8 = alarmWorld(checkShowing()), api8 = alarmApi(w8);
	var nyitva = api8.nyitottAblakok().map(function (a) { return a.nev; });
	ok(nyitva.indexOf('FARM_REF') !== -1, 'an open window is found', nyitva.join(','));
	ok(nyitva.indexOf('VIJE_REF1') !== -1, 'and so is a second one', nyitva.join(','));
	ok(nyitva.indexOf('VIJE_REF2') === -1, 'one that was never opened is not');
	ok(nyitva.indexOf('EPIT_REF') === -1, 'nor one that has been closed');
	ok(nyitva.indexOf('GYUJTO_REF') === -1, 'nor one that throws when asked');
	ok(nyitva.indexOf('BOT_REF') !== -1, 'the alarm window counts while it is open');
	ok(api8.nyitottAblakok().length === 3,
	   'and nothing else is dragged in', nyitva.join(','));

	/* After the check clears, the module windows are still sitting on it. */
	api8.BotvedelemBe();
	w8.page = tiszta();
	api8.BotvedelemKi();
	eq(w8.FARM_REF.navigated.length, 1, 'the farm window is sent back to its page');
	eq(w8.VIJE_REF1.navigated.length, 1, 'and so is the report window');
	eq(w8.EPIT_REF.navigated.length, 0, 'a closed one is left alone');

	/* Not with reload(): a farm window can be sitting on the result of a POST,
	   and repeating that request means sending the attack a second time. */
	eq(w8.FARM_REF.reloads, 0, 'without repeating whatever request got it there');
	eq(w8.VIJE_REF1.reloads, 0, 'for any of them');

	ok(stripComments(SZEM4_SRC).indexOf('includes("REF")') === -1,
	   'and nothing looks for these by sniffing global names any more');

	/* --- what counts as a bot check ---
	   One function answers this, so that raising the alarm and deciding it
	   has cleared can never disagree. */
	var jel = alarmApi(alarmWorld()).botvedelemJel;
	function lap(page) { return jel({ title: (page || {}).title || '',
		getElementById: function (id) { return (page || {})[id] || null; } }); }

	ok(lap({ botprotection_quest: {} }) !== '', 'the dismissable prompt is a check');
	ok(lap({ bot_check: {} }) !== '', 'so is the check box');
	ok(lap({ popup_box_bot_protection: {} }) !== '', 'so is the popup');
	ok(lap({}) === '', 'an ordinary page is not');
	ok(lap() === '', 'and neither is a bare page with no title at all');

	/* The title used to be compared for equality with the Hungarian wording,
	   so it never fired on any other server. */
	ok(lap({ title: 'Bot v\u00e9delem' }) !== '', 'the Hungarian title still counts');
	ok(lap({ title: 'Bot protection' }) !== '', 'and so does an English one');
	ok(lap({ title: 'Bot-Schutz' }) !== '', 'and a hyphenated one');

	/* Widening it must not make it trigger-happy: a false alarm halts every
	   module until he comes back and clears it by hand. */
	ok(lap({ title: 'Botond' }) === '', 'a village called Botond is not a bot check');
	ok(lap({ title: 'Bottrop (500|500)' }) === '', 'nor is one called Bottrop');
	ok(lap({ title: 'Jelent\u00e9sek' }) === '', 'nor an ordinary page title');

	/* A check seen only by its title used to look cleared on the very next
	   poll, because raising and clearing asked different questions. */
	var w7 = alarmWorld({ '#serverTime': { innerHTML: '12:34:56' }, title: 'Bot protection' });
	var api7 = alarmApi(w7);
	api7.BotvedelemBe();
	ok(w7.BOT === true, 'a check known only by its title raises the alarm');
	pollFor(w7, 20000);
	ok(w7.BOT === true, 'and is still raised twenty seconds later');
	eq(w7.liveTimers().length, 1, 'with the cycle still polling');
	w7.page = { '#serverTime': { innerHTML: '12:34:56' }, title: 'Falu \u00e1ttekint\u00e9s' };
	pollFor(w7, 10000);
	ok(w7.BOT === false, 'and lets go once the title says the check is gone');

	/* --- sweeping windows nothing is polling ---
	   A check used to be noticed only inside isPageLoaded(), so a window whose
	   module was between steps could sit on one indefinitely. */
	var w9 = alarmWorld(), api9 = alarmApi(w9);
	api9.botvedelemFigyelo();
	ok(w9.BOT === false, 'a sweep over clean windows raises nothing');

	w9.FARM_REF.page = { bot_check: {} };
	api9.botvedelemFigyelo();
	ok(w9.BOT === true, 'a check sitting in an unpolled window is found');
	ok(w9.logged.some(function (l) { return l.indexOf('FARM_REF') !== -1; }),
	   'and the log names the window it was in', w9.logged.join(' | '));

	/* Everything deliberately stopped -- a Sz\u00fcnet mind, say. There is no work
	   to interrupt, so waking the flat would be the wrong trade. */
	var w10 = alarmWorld();
	w10.futo = [];
	w10.FARM_REF.page = { bot_check: {} };
	alarmApi(w10).botvedelemFigyelo();
	ok(w10.BOT === false, 'nothing is raised while every module is stopped');

	/* One window going away must not hide a check in the next one. */
	var w11 = alarmWorld();
	Object.defineProperty(w11.FARM_REF, 'document',
		{ configurable: true, get: function () { throw new Error('elment'); } });
	w11.VIJE_REF1.page = { title: 'Bot protection' };
	alarmApi(w11).botvedelemFigyelo();
	ok(w11.BOT === true, 'a window that throws does not hide a check behind it');

	/* Already ringing: the alarm has its own cycle on BOT_REF. */
	var w12 = alarmWorld(checkShowing()), api12 = alarmApi(w12);
	api12.BotvedelemBe();
	var futTimerek = w12.liveTimers().length, naploHossz = w12.logged.length;
	w12.FARM_REF.page = { bot_check: {} };
	api12.botvedelemFigyelo();
	eq(w12.liveTimers().length, futTimerek, 'the sweep leaves a ringing alarm alone');
	/* BotvedelemBe() would refuse a second cycle anyway, so the timers alone
	   prove nothing -- the visible cost of sweeping through an alarm is a log
	   line every ten seconds for as long as it rings. */
	eq(w12.logged.length, naploHossz, 'without reporting the same check over and over');

	ok(stripComments(SZEM4_SRC).split('botvedelemFigyeloIndit').length - 1 >= 2,
	   'and something actually starts the sweep at launch');

	/* --- taking his word for it ---
	   Clicking "I typed the code" used to set BOT = false on the spot. If he
	   had misread it, or solved it in one window while another still held it,
	   every module started up again straight into a check still standing. */
	var w13 = alarmWorld(checkShowing()), api13 = alarmApi(w13);
	api13.BotvedelemBe();
	var hangok = w13.sounds.length;
	api13.BotvedelemKi();                    // he says he has solved it
	ok(w13.BOT === true, 'saying you typed the code does not by itself resume');
	ok(api13.ellenorzes() === true, 'SZEM goes and looks instead');
	eq(w13.botAblak.navigated.length, 1,
	   'fetching the page again rather than believing the one already on screen');
	ok(w13.audio.paused === true, 'and stops the noise while it looks');

	pollFor(w13, 10000);
	ok(w13.BOT === true, 'still halted while the check is still on the page');
	eq(w13.sounds.length, hangok, 'and still silent -- he is sat right there');

	/* It has to stop looking and say so, rather than poll for ever. */
	pollFor(w13, 15000);
	ok(api13.ellenorzes() === false, 'it stops looking after its own deadline');
	ok(w13.BOT === true, 'leaving every module halted');
	eq(w13.liveTimers().length, 0, 'and nothing left polling');
	ok(w13.logged.some(function (l) { return l.indexOf('m\u00e9g mindig l\u00e1tszik') !== -1; }),
	   'it says the check is still there', w13.logged.join(' | '));
	ok(w13.alerts[w13.alerts.length - 1].indexOf('BotvedelemKi') !== -1,
	   'and leaves the link to try again once he really has solved it');

	/* Its deadline is its own: he is stood there waiting for an answer, so it
	   must not make him wait out the three minutes an unanswered alarm gets. */
	ok(api13.ellenorzesMs() < api13.hatarido(),
	   'checking gives up sooner than waiting to be answered does');

	/* Clicking again, once the page really is clear. */
	w13.page = tiszta();
	api13.BotvedelemKi();
	ok(w13.BOT === false, 'clicking again once it is really gone does resume');
	ok(api13.ellenorzes() === false, 'and the checking flag is cleared behind it');
	ok(w13.logged.some(function (l) { return l.indexOf('Feloldva') !== -1; }),
	   'with the report of what was missed', w13.logged.join(' | '));

	/* Coming back long after a stand-down, when the window was let go: there is
	   nothing left to read, so one has to be opened before anything resumes. */
	var w14 = alarmWorld(checkShowing()), api14 = alarmApi(w14);
	api14.BotvedelemBe();
	pollFor(w14, 4 * 60000);
	ok(api14.botref() === null, 'the stand-down let the window go');
	w14.page = tiszta();
	api14.BotvedelemKi();
	ok(w14.BOT === true, 'which cannot be confirmed before a window has loaded');
	pollFor(w14, 10000);
	ok(w14.BOT === false, 'and coming back still resumes, on a page it re-read');

	/* Nothing halted: the link cannot be used to poke a running SZEM. */
	var w15 = alarmWorld(tiszta()), api15 = alarmApi(w15);
	api15.BotvedelemKi();
	/* Timers alone prove nothing here: on a clean page the cycle would run
	   once and settle. What must not happen is any of it happening at all. */
	eq(w15.logged.length, 0, 'clicking it when nothing is halted does nothing');
	eq(w15.alerts.length, 0, 'and says nothing');
	eq(w15.botAblak.navigated.length, 0, 'and goes poking at no pages');
	ok(api15.ellenorzes() === false, 'and starts no check of its own');

	/* --- how loud it gets ---
	   It used to climb by a fifth every 2.5s until it was at full volume,
	   which is unbearable in a flat you are not in. It has to stay put. */
	var w6 = alarmWorld(checkShowing()), api6 = alarmApi(w6);
	api6.BotvedelemBe();
	pollFor(w6, 60000);
	var levels = w6.sounds.filter(function (v) { return v > 0; });
	ok(levels.length > 3, 'the alarm keeps sounding while it waits', String(levels.length));
	ok(levels.every(function (v) { return v === levels[0]; }),
	   'and never gets louder than it started', levels.join(','));
	eq(levels[0], api6.hangero(), 'staying at the one level set for it');
	ok(api6.hangero() > 0 && api6.hangero() <= 1.0,
	   'which is a volume the audio element will accept', String(api6.hangero()));
	ok(SZEM4_SRC.indexOf('BOT_VOL') === -1,
	   'and nothing is left that climbs');

	/* A check cleared on its own, before the deadline, must end normally
	   rather than being treated as unanswered. */
	var w5 = alarmWorld(checkShowing()), api5 = alarmApi(w5);
	api5.BotvedelemBe();
	pollFor(w5, 30000);
	w5.page = { '#serverTime': { innerHTML: '12:34:56' } };   // the check is gone
	pollFor(w5, 10000);
	ok(w5.BOT === false, 'a check that clears itself lets the modules run again');
	ok(api5.feladva() === false, 'and is not recorded as unanswered');
});

/* ------------------------------------------------------------------------ */
suite('Loading the saved build data', function () {
	function vilag(raw) {
		var w = { AZON: 'p_w', alerts: [], logged: [], hibak: [], alkalmazva: [] };
		w.localStorage = { getItem: function (k) { return k === 'p_w_epit' ? raw : null; },
		                   setItem: function () {} };
		w.szem4_EPITO_applyState = function (s) { w.alkalmazva.push(s); };
		w.szem4_EPITO_parseLegacy = function () { return { groups: [], villages: [] }; };
		w.alert2 = function (m) { w.alerts.push(m); };
		w.naplo = function (k, m) { w.logged.push(k + ': ' + m); };
		w.debug = function (k, e) { w.hibak.push(k + ': ' + e); };
		return w;
	}
	function betolt(w) {
		sandbox(w, [sliceFn(SZEM4_SRC, 'szem4_ADAT_epito_load')]).szem4_ADAT_epito_load();
	}

	var w = vilag(JSON.stringify({ v: 2, groups: [{}, {}], villages: [{}, {}, {}] }));
	betolt(w);
	/* The whole function is wrapped in a catch that only calls debug(), so a
	   silent throw would otherwise look exactly like a quiet success. */
	eq(w.hibak.length, 0, 'loading the build data does not throw', w.hibak.join(' | '));
	eq(w.alkalmazva.length, 1, 'and does apply what it read');

	/* It used to open a modal on every single start, to say nothing had gone
	   wrong -- and it had to be clicked away before SZEM could be used. */
	eq(w.alerts.length, 0, 'and opens no window to be dismissed on every start');
	ok(w.logged.some(function (l) { return l.indexOf('2 csoport') !== -1 && l.indexOf('3 falu') !== -1; }),
	   'saying what it loaded in the log instead', w.logged.join(' | '));

	/* Nothing saved yet: nothing to apply, and nothing worth reporting. */
	var w2 = vilag(null);
	betolt(w2);
	eq(w2.alkalmazva.length, 0, 'with nothing saved it applies nothing');
	eq(w2.alerts.length, 0, 'and still opens no window');
	eq(w2.logged.length, 0, 'and does not pad the log either');
});

/* ------------------------------------------------------------------------ */
suite('Sorting a table', function () {
	/* A real table in a real document: the bug here is about where the sorted
	   rows end up in the DOM, which a fake table could not show. */
	function tabla() {
		var wrap = document.createElement('div');
		wrap.style.display = 'none';
		wrap.innerHTML = '<table id="teszt_farm">' +
			'<tr><th>Hova</th><th>Szerelv\u00e9nyek</th><th>T\u00e1v</th></tr>' +
			'<tr><td>a</td><td>sz1</td><td>4.2</td></tr>' +
			'<tr><td>b</td><td>sz2</td><td>1.5</td></tr>' +
			'<tr><td>c</td><td>sz3</td><td>12.0</td></tr></table>';
		document.body.appendChild(wrap);
		return wrap;
	}

	var wrap = tabla();
	var hiba = '';
	var api = sandbox({ hideFarms: function () {}, alert2: function (m) { hiba = m; } },
	                  [sliceFn(SZEM4_SRC, 'rendez')]);

	/* The browser's parser puts rows in a tbody. Nothing below may change that. */
	eq(document.querySelectorAll('#teszt_farm > tbody > tr').length, 4,
	   'the table starts out with every row inside its tbody');

	api.rendez('tav', false, document.createElement('a'), 'teszt_farm', 2);
	eq(hiba, '', 'sorting by distance does not throw');

	var sorok = document.querySelectorAll('#teszt_farm tr');
	eq(sorok[1].cells[2].textContent, '1.5', 'the nearest target comes first');
	eq(sorok[2].cells[2].textContent, '4.2', 'then the next');
	eq(sorok[3].cells[2].textContent, '12.0', 'and the furthest last');

	/* The bug: the sorted rows were put back with appendChild on the table
	   itself, which drops them in after the tbody rather than inside it. Every
	   rule written as "#farm_hova > tbody > tr > td" then stops matching -- which
	   is how sorting by T\u00e1v collapsed the Szerelv\u00e9nyek column, whose width is set
	   by exactly such a rule. */
	eq(document.querySelectorAll('#teszt_farm > tbody > tr').length, 4,
	   'and every row is still inside the tbody afterwards');
	eq(document.querySelectorAll('#teszt_farm > tr').length, 0,
	   'with none of them loose in the table');

	/* Sorting again must not undo it either. */
	api.rendez('szoveg', false, document.createElement('a'), 'teszt_farm', 0);
	eq(document.querySelectorAll('#teszt_farm > tbody > tr').length, 4,
	   'a second sort keeps them there too');

	/* The rule the column depends on is still shaped that way. */
	ok(SZEM4_SRC.indexOf('#farm_hova > tbody > tr > td:nth-child(6)') !== -1,
	   'and the wagons column is still styled through the tbody');

	wrap.remove();
});

/* ------------------------------------------------------------------------ */
suite('The interface can reach what it calls', function () {
	/* verifyInlineHandlers() runs at startup and names any control calling a
	   function that is not on window. It cannot tell a real call from a string
	   that merely looks like one, so a tooltip documenting example syntax such
	   as ANY(barracks 5) was once reported live as a broken control (53e09f3).
	   A false alarm there is expensive: the check is only worth having while it
	   stays silent when nothing is wrong.

	   The two patterns below are copied from verifyInlineHandlers so this test
	   sees exactly what it sees -- in particular ["']([^"']*)["'] stops at the
	   first inner quote, which is why prose inside sugo(this,'...') is never
	   scanned. The assertion underneath fails if the real ones are edited, so
	   the copy cannot quietly drift. */
	ok(SZEM4_SRC.indexOf('/\\bon[a-z]+\\s*=\\s*["\']([^"\']*)["\']|javascript:\\s*([^"\'`]*)/g') !== -1,
	   'the handler pattern still matches the copy in this test');
	ok(SZEM4_SRC.indexOf('/(^|[^.\\w$])([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\(/g') !== -1,
	   'the call pattern still matches the copy in this test');

	/* Comments are stripped first: the live check reads the built interface and
	   never sees them, and the file's own header describes verifyInlineHandlers()
	   in prose that would otherwise be scanned as though it were a control.
	   If the stripper ever mangled a string, this would stop parsing. */
	var code = stripComments(SZEM4_SRC);
	try { new Function(code); ok(true, 'the source still parses with comments stripped'); }
	catch (e) { ok(false, 'the source still parses with comments stripped', e.message); }
	ok(code.indexOf('szunetMind') !== -1 && code.indexOf('onmouseover') !== -1,
	   'and the markup survived the stripping');

	var names = exportedNames(), offenders = [];
	var handler = /\bon[a-z]+\s*=\s*["']([^"']*)["']|javascript:\s*([^"'`]*)/g, found;
	while ((found = handler.exec(code)) !== null) {
		var body = found[1] || found[2] || '';
		var call = /(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g, c;
		while ((c = call.exec(body)) !== null) {
			var n = c[2];
			if (names.indexOf(n) !== -1) continue;
			if (typeof window[n] === 'function') continue;   // a browser built-in such as open
			if (offenders.indexOf(n) === -1) offenders.push(n);
		}
	}
	ok(offenders.length === 0,
	   'every call-shaped name in an inline handler is exported or built in',
	   offenders.join(', '));
});

/* ------------------------------------------------------------------------ */
suite('The palette', function () {
	/* Every colour in the stylesheet is meant to come from the :root block, so
	   the interface can be retuned from one place. Four of those colours exist
	   a second time as the default values of the style boxes on the sound
	   panel, because onWallpChange() writes them back as inline styles that
	   beat the stylesheet -- if the two copies drift, changing a token quietly
	   does nothing and the old colour comes back on every start. */
	var css = szemCss();

	function token(nev) {
		var m = css.match(new RegExp('--szem-' + nev + ':\\s*([^;]+);'));
		return m ? m[1].trim() : '';
	}
	/* The value the box is born with, straight out of the built markup. */
	function boxDefault(nev) {
		var m = SZEM4_SRC.match(new RegExp('name="' + nev + '" value="([^"]*)"'));
		return m ? m[1] : '';
	}
	/* And what the help column next to it claims that value is. */
	function helpDefault(ertek) {
		return SZEM4_SRC.indexOf('[Default: ' + ertek + ']') !== -1;
	}

	ok(css.indexOf(':root {') !== -1, 'the stylesheet opens with a token block');

	var parok = [
		['bg',     'content_bgcolor'],
		['text',   'content_fontcolor'],
		['line',   'content_border'],
		['shadow', 'content_shadow']
	];
	parok.forEach(function (p) {
		var t = token(p[0]), d = boxDefault(p[1]);
		ok(t !== '', 'there is a --szem-' + p[0] + ' token', t);
		eq(d, t, 'the ' + p[1] + ' box starts on the same colour as --szem-' + p[0]);
		ok(helpDefault(t), 'and the help text beside it names that colour too', d);
	});

	/* The point of the block: no bare colour left behind in the sheet. These
	   are the ones the old sheet actually used, and each was a real eyesore
	   against near-black -- a yellow frame, a blue button, a white chip. */
	var szabalyok = szemCssRules();
	['yellow', 'lavenderblush', '#0d47a1', '#3366CC', '#FFFF77', '#111'].forEach(function (szin) {
		eq(szabalyok.indexOf(szin), -1, 'no ' + szin + ' left loose in the stylesheet');
	});

	/* The accent is meant to be the restrained one, not a second theme: it may
	   pick out a link or a live edge, but it must not become a background for
	   whole panels. */
	ok(css.indexOf('--szem-accent:') !== -1, 'there is a single accent token');
});

/* ------------------------------------------------------------------------ */
suite('Replacing the pre-palette colours', function () {
	/* Anyone who has run SZEM once has the old style defaults in storage, and
	   they are written back as inline styles that beat the stylesheet. So the
	   palette only actually arrives if those stored copies are moved on. */
	var api = sandbox({}, [sliceFrom(SZEM4_SRC, 'var REGI_STILUS_ALAP', 'upgradeStyleDefaults')]);

	function regi() {
		return {
			selectedProfile: 1,
			profile1: { content_bgcolor: '#111', content_fontcolor: 'white',
			            content_border: 'yellow', content_shadow: '0 0 12px black' },
			profile2: {}, profile3: {}, profile4: {}
		};
	}

	var s = regi();
	var n = api.upgradeStyleDefaults(s);
	eq(s.profile1.content_bgcolor, '#0b0d10', 'the old page colour moves to the new one');
	eq(s.profile1.content_fontcolor, '#dfe4ea', 'and the old text colour');
	eq(s.profile1.content_border, '#272e37', 'and the yellow frame');
	eq(s.profile1.content_shadow, '0 2px 24px rgba(0,0,0,0.65)', 'and the old drop shadow');
	eq(n, 4, 'and it reports how many it moved', String(n));

	/* The half of this that matters most: a colour that was actually chosen is
	   not a default, and must survive untouched. */
	var sajat = regi();
	sajat.profile1.content_bgcolor = '#4b0082';
	sajat.profile2.content_border = 'red';
	var n2 = api.upgradeStyleDefaults(sajat);
	eq(sajat.profile1.content_bgcolor, '#4b0082', 'a colour that was picked is left alone');
	eq(sajat.profile2.content_border, 'red', 'in any profile, not just the active one');
	eq(n2, 3, 'and only the untouched defaults are counted', String(n2));

	/* Nothing to do must stay quiet: the count is what decides whether a line
	   is written to the log, so a stray 1 here would nag on every single start. */
	var mar = regi();
	api.upgradeStyleDefaults(mar);
	eq(api.upgradeStyleDefaults(mar), 0, 'running it a second time changes nothing');
	eq(api.upgradeStyleDefaults({ profile1: {} }), 0, 'and a profile with no colours in it is left alone');
	eq(api.upgradeStyleDefaults(null), 0, 'with nothing saved at all it does nothing');

	/* Every profile, not only profile1 -- there are four and any of them can
	   be the one selected. */
	var mind = { profile1: { content_border: 'yellow' }, profile2: { content_border: 'yellow' },
	             profile3: { content_border: 'yellow' }, profile4: { content_border: 'yellow' } };
	eq(api.upgradeStyleDefaults(mind), 4, 'all four profiles are covered');

	/* And what it moves them to has to be what the stylesheet actually uses,
	   or retuning a token would quietly leave this pointing at a dead colour. */
	var css = szemCss();
	function token(nev) {
		var m = css.match(new RegExp('--szem-' + nev + ':\\s*([^;]+);'));
		return m ? m[1].trim() : '';
	}
	var frissP = regi();
	api.upgradeStyleDefaults(frissP);
	eq(frissP.profile1.content_bgcolor, token('bg'), 'the new page colour is the --szem-bg token');
	eq(frissP.profile1.content_fontcolor, token('text'), 'the new text colour is the --szem-text token');
	eq(frissP.profile1.content_border, token('line'), 'the new frame colour is the --szem-line token');
	eq(frissP.profile1.content_shadow, token('shadow'), 'the new shadow is the --szem-shadow token');
});

/* ------------------------------------------------------------------------ */
suite('The preview mirrors the real interface', function () {
	/* preview.html rebuilds a slice of the interface by hand so the styling can
	   be looked at without a game behind it. That only works while its markup
	   says what the real markup says -- otherwise it flatters a design that is
	   not the one shipping. Nothing can diff the two automatically, so the
	   pieces the stylesheet actually hangs off are named here instead. */
	ok(PREVIEW_SRC.length > 1000, 'the preview page loaded', PREVIEW_SRC.length + ' chars');

	/* Hooks the stylesheet selects on. Each must exist on both sides. */
	['id="fejresz"', 'id="sugo"', 'id="menuk"', 'id="kiegs"',
	 'class="divrow menubar"', 'menubar_jobb', 'menubar_valaszto',
	 'class="fej"', 'id="content"', 'class="menuitem"',
	 'id="alert2head"', 'id="global_notifications"',
	 'left-background', 'right-background'].forEach(function (hook) {
		ok(SZEM4_SRC.indexOf(hook) !== -1, 'the interface has ' + hook);
		ok(PREVIEW_SRC.indexOf(hook) !== -1, 'and so does the preview');
	});

	/* The header wordmark: the banner used to be a picture, and the <h1> under
	   it was empty. If one side goes back to a picture the preview stops
	   showing what the header really looks like. */
	ok(SZEM4_SRC.indexOf('<h1>Szem <b>IV</b><i>Kl\u00e1nh\u00e1bor\u00fa</i></h1>') !== -1,
	   'the header names the program in type');
	ok(PREVIEW_SRC.indexOf('<h1>Szem <b>IV</b><i>Kl\u00e1nh\u00e1bor\u00fa</i></h1>') !== -1,
	   'and the preview shows the same header');
	eq(SZEM4_SRC.indexOf("wallp.jpg"), -1, 'with no banner picture left behind it');
	eq(PREVIEW_SRC.indexOf("wallp.jpg"), -1, 'on either side');

	/* The farm table is the widest thing the interface holds and the one whose
	   columns are addressed by index, so the preview has to keep all seven. */
	var fej = PREVIEW_SRC.slice(PREVIEW_SRC.indexOf('id="farm_hova"'));
	fej = fej.slice(0, fej.indexOf('</tr>'));
	eq((fej.match(/<th/g) || []).length, 7, 'the preview farm table still has seven columns');

	/* The Szerelvények column is the widest cell in that table, and the
	   preview filled it with mozdony.png -- a locomotive, at 18px, where
	   addWagons() puts 40px wagon pictures. So the one cell most worth
	   looking at was the one the preview was not showing. */
	ok(/wagon_/.test(PREVIEW_SRC),
	   'and fills the wagon column with the pictures that column really uses');
	eq(PREVIEW_SRC.indexOf('mozdony.png'), -1,
	   'not with artwork the interface never puts there');

	/* The Farmoló panel is no longer mirrored by hand at all -- it is built
	   from the template literal the script really carries. A hand-written
	   stand-in is what hid the settings block, the unit picker and the two
	   add-a-village forms while the interface was being restyled: they were
	   simply never on the page being looked at. */
	ok(PREVIEW_SRC.indexOf('farmPanelBol') !== -1,
	   'the preview builds the Farmoló panel from the real markup');
	ok(PREVIEW_SRC.indexOf("ujkieg(\"farm\",\"Farmol\u00f3\",`") !== -1,
	   'reading it out of the source by the same marker the script defines it with');
	ok(SZEM4_SRC.indexOf('ujkieg("farm","Farmol\u00f3",`') !== -1,
	   'and that marker is really what the script uses');

	/* Every helper the markup calls has to be one the preview fills in, or
	   the panel renders with a hole where that call was.

	   Asked one helper at a time against the preview's own stub list, rather
	   than as "the set is exactly these four". The exact-set form fires just
	   as loudly when the markup stops NEEDING one, which is a false alarm --
	   it went off the moment the last pic() left this panel, and a guard that
	   cries wolf over a removal is one that gets edited without being read.
	   What has to stay loud is a helper the preview has never heard of. */
	var panel = SZEM4_SRC.slice(SZEM4_SRC.indexOf('ujkieg("farm","Farmol\u00f3",`'));
	panel = panel.slice(0, panel.indexOf('`', 30));
	var hivasok = {};
	(panel.match(/\$\{\s*([A-Za-z_$][\w$]*)\s*\(/g) || []).forEach(function (m) {
		hivasok[m.replace(/[${(\s]/g, '')] = 1;
	});

	/* Read off the preview's own call, found by the argument that follows the
	   stub names, because preview.html builds more than one Function. */
	var stubVege = PREVIEW_SRC.indexOf("'return `'");
	var stubSor = PREVIEW_SRC.slice(PREVIEW_SRC.lastIndexOf('new Function(', stubVege), stubVege);
	var stubolt = (stubSor.match(/'([A-Za-z_$][\w$]*)'/g) || []).map(function (s) {
		return s.replace(/'/g, '');
	});

	ok(stubolt.length >= 3, 'the preview names the helpers it fills in', stubolt.join(','));
	ok(Object.keys(hivasok).length >= 3, 'and the panel markup really does call some',
	   Object.keys(hivasok).sort().join(','));
	Object.keys(hivasok).sort().forEach(function (nev) {
		ok(stubolt.indexOf(nev) !== -1, 'the preview fills in ' + nev + ', which the markup calls');
	});

	/* Root-relative game art resolves on the game's domain and nowhere else,
	   so the preview has to point it somewhere real or it shows broken
	   images -- which is exactly what it used to do for the mine levels. */
	ok(panel.indexOf('src="/graphic/') !== -1,
	   'the panel does ask for game art by root-relative path');
	ok(PREVIEW_SRC.indexOf('src="\\/graphic\\/') !== -1 ||
	   PREVIEW_SRC.indexOf('/graphic/') !== -1,
	   'and the preview rewrites those to somewhere they load from');
});

/* ------------------------------------------------------------------------ */
suite('The preview shows the capacity row', function () {
	/* Every other part of the Farmoló panel is markup, so mirroring the markup
	   is enough. This row is not: the panel carries an empty div and
	   farmStatKiir() fills it at runtime off counters that only exist once real
	   reports have been analysed. Holding the two texts side by side would
	   therefore prove nothing about it.

	   So the test does what the page does -- compiles the real reading code out
	   of the real source, through the preview's own slicing functions. A rename
	   on either side lands here rather than as a preview that silently shows an
	   empty strip. */
	var doboz = document.createElement('div');
	doboz.id = 'farm_kapacitas';
	document.body.appendChild(doboz);
	try {
		/* Compiled inside a catch, so a slice that no longer finds what it names
		   reads as this one named failure. Left to throw, it would abort the
		   suite and report "threw before finishing" -- hiding which of the
		   checks below would have died with it. */
		var api = null, baj = '';
		try {
			var kod = ['fuggvenyKivag', 'allandokKivag', 'farmStatBetolt']
				.map(function (n) { return sliceFn(PREVIEW_SRC, n); }).join('\n\n');
			/* A made-up asset prefix rather than the real CDN: what matters is
			   that the rewrite ran at all, and a sentinel says so without a
			   request going out. */
			api = new Function('FORRAS',
				'var GAME_ASSET = "ASSET/";\n' + kod +
				'\nreturn farmStatBetolt(FORRAS);')(SZEM4_SRC);
		} catch (e) { baj = e.message; }

		ok(api && typeof api.fest === 'function',
		   'the preview compiles the real reading code out of the real source', baj);
		if (!api) return;

		var ures = api.fest(null);
		ok(ures.indexOf('&ndash;') !== -1 || ures.indexOf('–') !== -1,
		   'with no counters at all it shows a dash, not a number');

		/* Deliberately the 'tele' reading: it is the only one that recommends a
		   size it did not measure, so it exercises the whole chain -- verdict,
		   step up, and the army drawn in units. */
		var teli = { jelentes: 40, jelTeher: 16000, zsakmany: 12800, tele: 18,
		             kuldes: 55, minsereg: 2, keves: 1,
		             pop: 800, popMinta: 40, u_light: 200 };
		eq(api.ertekel(teli).szint, 'tele',
		   'and reads these counters as the reading the checks below assume');

		/* Painted into a real element and read back off it. A readout's
		   likeliest failure is being computed and then dropped on the floor,
		   and no test of the pure function can see that happen. */
		var festett = api.fest(teli);
		ok(festett.indexOf('80%') !== -1, 'the measured fill rate is shown');
		ok(doboz.querySelector('.szem4_kapacitas_ajanlas') !== null,
		   'the recommendation really lands in the element');
		ok(doboz.querySelector('.szem4_kapacitas_egyseg') !== null,
		   'with the recommended army drawn in unit pictures');
		eq(festett.indexOf('src="/graphic/'), -1,
		   'and no root-relative art is left to fail to load');
		ok(festett.indexOf('src="ASSET/unit/') !== -1,
		   'because the preview repoints it the same way it does the panel');
	} finally {
		doboz.parentNode.removeChild(doboz);
	}
});

/* ------------------------------------------------------------------------ */
suite('The type', function () {
	var szabalyok = szemCssRules();

	/* A stylesheet's @import is ignored, silently, if any rule comes before
	   it. The palette block sits at the top of this sheet and is the obvious
	   place for someone to add a rule, so the ordering is worth pinning: the
	   failure mode is not an error anywhere, just the fonts quietly never
	   arriving while the CSS still says they should. */
	ok(szabalyok.trim().indexOf('@import') === 0,
	   'the font import comes before any rule, or the browser drops it',
	   szabalyok.trim().slice(0, 40));
	ok(/fonts\.googleapis\.com/.test(szabalyok), 'and it is the font stylesheet being asked for');

	/* Both faces are wanted but neither is depended on: the game page may
	   refuse the request, and the interface has to look like itself anyway
	   rather than falling back to a browser serif. */
	var olvaso = szemCss().match(/--szem-font:\s*([^;]+);/)[1];
	var fejlec = szemCss().match(/--szem-font-fej:\s*([^;]+);/)[1];
	ok(/Inter/.test(olvaso), 'the reading face is asked for first');
	ok(/Chakra Petch/.test(fejlec), 'and the heading face');
	[['reading', olvaso], ['heading', fejlec]].forEach(function (p) {
		ok(/Segoe UI/.test(p[1]) && /sans-serif\s*$/.test(p[1].trim()),
		   'the ' + p[0] + ' stack still ends in what was there before', p[1].trim());
	});

	/* The display face belongs on headings only. Putting it on the body
	   would be the obvious "make it all look cool" mistake, and it is the
	   one that makes a screen of numbers harder to read. */
	ok(/#fejresz h1, #content h2, #content table\.vis th \{\s*font-family: var\(--szem-font-fej\);/.test(szabalyok),
	   'the heading face is named for the headings');
	ok(/body, \.fej, #content \{\s*font-family: var\(--szem-font\);/.test(szabalyok),
	   'and the body takes the reading face');

	/* One stack, named once. It used to be spelled out on the body rule. */
	eq(szabalyok.indexOf('font-family: "Segoe UI"'), -1,
	   'no rule spells the stack out beside the tokens that already hold it');
});

/* ------------------------------------------------------------------------ */
suite('The tables', function () {
	/* The data tables used to be left to the game: "vis" is the game's class,
	   and SZEM only set the text to black, which is readable exactly as long
	   as the game keeps painting something pale underneath. They are stated
	   outright now -- but the colour boxes on the sound panel have to keep
	   beating them, or picking a colour silently stops working.

	   Specificity is not something to reason about on paper, so the whole
	   thing is built in an iframe and the browser is asked what it computed. */
	var css = szemCss();

	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; top:0; width:1200px; height:600px;';
	document.body.appendChild(keret);
	var d = keret.contentDocument;
	d.open();
	d.write('<!doctype html><html><head><style>' + css + '</style></head><body>' +
	        '<div id="content">' +
	        '<table class="vis" id="naploka"><tbody>' +
	        '<tr><th id="th1">D\u00e1tum</th></tr><tr><td id="td1">most</td></tr>' +
	        '</tbody></table>' +
	        '<table class="vis" id="farm_hova"><tbody>' +
	        '<tr><td id="td2">500|500</td></tr>' +
	        '</tbody></table>' +
	        '</div></body></html>');
	d.close();

	function szin(id, prop) {
		return keret.contentWindow.getComputedStyle(d.getElementById(id))[prop];
	}

	/* Nothing pale is being painted underneath in here, so black text would be
	   invisible -- which is exactly what it was on any page the game did not
	   dress for SZEM. */
	ok(szin('td1', 'color') !== 'rgb(0, 0, 0)',
	   'a table cell is not black text waiting for the game to light it up', szin('td1', 'color'));
	ok(szin('th1', 'backgroundColor') !== 'rgba(0, 0, 0, 0)',
	   'and the header row paints its own background', szin('th1', 'backgroundColor'));

	/* The header is the accent amber now, carrying near-black text.

	   What is worth asserting is not which two tokens were named -- that is
	   just restating the rule -- but whether the pair can actually be read.
	   The headers reported as unreadable were dim grey on tan, a pairing that
	   clears no contrast bar at all, and naming tokens would not have caught
	   it. So the browser is asked what it computed and the ratio is worked
	   out from that. 4.5:1 is the ordinary bar for body-sized text. */
	function fenyero(s) {
		var c = s.match(/[0-9.]+/g).slice(0, 3).map(function (v) {
			v = Number(v) / 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	}
	function kontraszt(a, b) {
		var la = fenyero(a), lb = fenyero(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	}

	/* Read the accent off the sheet rather than repeating its hex here, so
	   this keeps testing "the header matches the wordmark" and not "the
	   header is #d9a441", which would just have to be edited in step. */
	var proba = d.createElement('div');
	proba.style.color = 'var(--szem-accent)';
	d.body.appendChild(proba);
	var accentRgb = keret.contentWindow.getComputedStyle(proba).color;

	eq(szin('th1', 'backgroundColor'), accentRgb,
	   'a header is painted the same amber as the IV in the wordmark');
	ok(kontraszt(szin('th1', 'backgroundColor'), szin('th1', 'color')) >= 4.5,
	   'and its label is readable on it',
	   kontraszt(szin('th1', 'backgroundColor'), szin('th1', 'color')).toFixed(2) + ':1');
	proba.remove();

	/* Three things live inside a header and would each have gone amber on
	   amber if only the background had been changed. */
	var fejSzabalyok = szemCssRules();
	ok(/th\[onclick\]:hover\s*\{[^}]*background:/.test(fejSzabalyok),
	   'a hovered sortable header answers with its background');
	ok(!/th\[onclick\]:hover\s*\{[^}]*color:\s*var\(--szem-accent\)/.test(fejSzabalyok),
	   'and not by turning its label the colour it is already painted');
	ok(/th input\[type="checkbox"\]\s*\{[^}]*accent-color:\s*var\(--szem-on-accent\)/.test(fejSzabalyok),
	   'the select-all tick box in a header is drawn to show up on one');
	eq((SZEM4_SRC.match(/szemIkon\('search'\)/g) || []).length, 0,
	   'and no search icon is left drawing itself in the panel colour inside a header');

	/* Now the colour boxes, written exactly the way onWallpChange writes them.
	   The assertions under this pin the shapes, so the copy cannot drift. */
	ok(SZEM4_SRC.indexOf('.vis:not(#farm_honnan):not(#farm_hova) td { background: ') !== -1,
	   'the cell-background rule still has the shape this test copies');
	ok(SZEM4_SRC.indexOf('.vis th { background: ') !== -1 && SZEM4_SRC.indexOf(' !important; }`') !== -1,
	   'and the header rule still carries !important');

	var valasztott = d.createElement('style');
	valasztott.textContent =
		'.vis:not(#farm_honnan):not(#farm_hova) td { background: rgb(1, 2, 3); }' +
		'.vis:not(#farm_honnan):not(#farm_hova) td { color: rgb(4, 5, 6); }' +
		'.vis th { background: rgb(7, 8, 9) !important; }' +
		'.vis th { color: rgb(10, 11, 12) !important; }';
	d.head.appendChild(valasztott);

	eq(szin('td1', 'backgroundColor'), 'rgb(1, 2, 3)', 'a picked cell background still wins');
	eq(szin('td1', 'color'), 'rgb(4, 5, 6)', 'and a picked cell colour');
	eq(szin('th1', 'backgroundColor'), 'rgb(7, 8, 9)', 'and a picked header background');
	eq(szin('th1', 'color'), 'rgb(10, 11, 12)', 'and a picked header colour');

	/* The farm tables are left out of those rules on purpose -- they carry
	   their own colouring per row -- so they must NOT follow the picked
	   colour, and must still be readable on their own. */
	eq(szin('td2', 'backgroundColor'), 'rgba(0, 0, 0, 0)',
	   'the farm table is deliberately left out of the picked background');
	ok(szin('td2', 'color') !== 'rgb(0, 0, 0)',
	   'and is still readable without it', szin('td2', 'color'));

	keret.remove();

	/* The assumption that something else paints the background is gone. */
	var szabalyok = szemCssRules();
	eq(szabalyok.indexOf('color: black'), -1, 'no cell is left waiting on a black-text assumption');
	eq(szabalyok.indexOf('color:black'), -1, 'spelled either way');
});

/* ------------------------------------------------------------------------ */
suite('Clearing a marking clears it', function () {
	/* Five places wrote the literal #f4e4bc, and not one of them was choosing
	   a colour: every one was clearing a marking, and the builder even spells
	   its case "alap". The value was a hand-copied sample of the beige the
	   tables used to be, so on the dark palette "nothing is flagged here"
	   started rendering as a cream block with unreadable text on it -- which
	   is what got reported.

	   Matched with the quotes on purpose. The constant's own comment names
	   the old colour to explain itself, and a bare search for the hex cannot
	   tell that apart from the hex still being used. */
	eq(SZEM4_SRC.indexOf('"#f4e4bc"'), -1, 'no cell is painted the old table beige to mean "unmarked"');
	eq(SZEM4_SRC.indexOf("'#f4e4bc'"), -1, 'spelled either way');

	var hivasok = [];
	var vilag = {
		SZEM4_FARM: { DOMINFO_FARMS: { '500|500': { szin: {} } } },
		multipricer: function () { hivasok.push([].slice.call(arguments)); }
	};

	/* JELZO_NINCS is a top-level var, so it is taken from the source with the
	   functions and read back through an accessor -- a var declared inside
	   the compiled scope does not escape it. */
	var deklaracio = SZEM4_SRC.match(/var JELZO_NINCS = [^;]*;/)[0];
	var api = sandbox(vilag, [
		deklaracio,
		sliceFn(SZEM4_SRC, 'hattertolor'),
		sliceFn(SZEM4_SRC, 'hattercsere')
	], { JELZO_NINCS: 'JELZO_NINCS' });

	eq(api.JELZO_NINCS(), '', 'clearing takes the inline colour off rather than picking another one');

	/* A real table: these functions walk from the cell to its row with
	   closest() to find the coordinate, which a stand-in object cannot do. */
	var tabla = document.createElement('table');
	tabla.innerHTML = '<tbody><tr><td>500|500</td><td>x</td><td>w</td></tr></tbody>';
	document.body.appendChild(tabla);
	var sor = tabla.rows[0];

	var falu = sor.cells[0];
	falu.style.backgroundColor = 'red';
	api.hattertolor(falu);
	eq(falu.style.backgroundColor, '',
	   'a cleared row goes back to the table colour instead of a cream of its own');
	eq(vilag.SZEM4_FARM.DOMINFO_FARMS['500|500'].szin.falu, '', 'and stores no colour for it');

	/* The three colours that ARE read back as state must not get swept up in
	   this. The farm engine skips a row whose first cell is red, and
	   hattercsere recognises its own green to know which way it is toggling,
	   so emptying those would change what gets attacked. */
	var fal = sor.cells[2];
	api.hattercsere(fal);
	eq(fal.style.backgroundColor, 'rgb(0, 255, 0)', 'marking a wall cell still turns it green');
	api.hattercsere(fal);
	eq(fal.style.backgroundColor, 'rgb(0, 255, 0)', 'a second click still reads that green back');
	ok(fal.style.border !== '', 'and adds the mark on top of it', fal.style.border);
	api.hattercsere(fal);
	eq(fal.style.backgroundColor, '', 'and only the third click clears the marking off');
	eq(fal.style.border, '', 'along with the mark');

	tabla.remove();
});

/* ------------------------------------------------------------------------ */
suite('The farm search control stays in its header', function () {
	/* Both farm tables put a search icon and a select-all box in the corner of
	   a header cell, positioned absolutely. An absolutely positioned element
	   measures from its nearest positioned ancestor, and #content is
	   positioned -- so a header without an anchor of its own sends the control
	   to the top right corner of the entire panel instead of its own corner.

	   That is what had happened to the Szerelvények one: its twin over on
	   farm_honnan carried position:relative inline and it did not. Asking the
	   browser what the control actually measures from is the only way to see
	   this; reading the CSS cannot. */
	var css = szemCss();

	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; top:0; width:1200px; height:600px;';
	document.body.appendChild(keret);
	var d = keret.contentDocument;
	d.open();
	/* #content is positioned in the real interface, which is the whole trap. */
	d.write('<!doctype html><html><head><style>' + css + '</style></head><body>' +
	        '<div id="content"><table class="menuitem"><tbody><tr><td>' +
	        '<table class="vis" id="farm_hova"><tbody><tr>' +
	        '<th id="fejcella" style="height: 20px; vertical-align:middle;">Szerelv\u00e9nyek' +
	        '<span id="kereso" style="position:absolute;right: 7px;top: 3px;">x</span>' +
	        '</th></tr></tbody></table>' +
	        '</td></tr></tbody></table></div></body></html>');
	d.close();

	eq(keret.contentWindow.getComputedStyle(d.getElementById('content')).position, 'relative',
	   'the trap is real: #content is a positioned ancestor');

	var kereso = d.getElementById('kereso');
	eq(kereso.offsetParent && kereso.offsetParent.id, 'fejcella',
	   'the search control measures from its own header cell');

	/* And lands inside it, not several hundred pixels away at the panel edge. */
	var k = kereso.getBoundingClientRect(), f = d.getElementById('fejcella').getBoundingClientRect();
	ok(k.left >= f.left - 1 && k.right <= f.right + 1,
	   'so it sits within that cell rather than at the corner of the panel',
	   'control ' + Math.round(k.left) + '-' + Math.round(k.right) +
	   ', cell ' + Math.round(f.left) + '-' + Math.round(f.right));

	keret.remove();

	/* The anchor is stated once for every header now. The cell that used to
	   carry it inline should no longer need to, and if the rule is ever lost
	   both controls break together rather than one quietly. */
	/* Asked of the shared header rule itself rather than of two lines that
	   happen to sit next to each other: this used to match on the anchor
	   being immediately followed by one particular background, so recolouring
	   the header broke it while the anchor was still perfectly in place. */
	ok(/#content table\.vis th \{[^}]*position: relative;/.test(szemCssRules()),
	   'the header rule is what provides the anchor');
	eq(SZEM4_SRC.indexOf('style="position: relative; height: 20px; min-width: 100px"'), -1,
	   'and no header states it inline any more');
});

/* ------------------------------------------------------------------------ */
suite('The layout holds together at any width', function () {
	/* The interface was a flat 1024px, written out in four places, with the
	   two wallpaper panes worked out as calc(50vw - 512px) -- half of it,
	   spelled again. On a window narrower than 1024 that goes negative: the
	   panes collapse and the interface runs off the side of the screen.

	   It is one token now and everything is derived from it. What matters is
	   that the derived pieces still meet exactly -- header over content, panes
	   filling the gap either side with no seam and no overlap -- so the whole
	   thing is measured in a real browser at several widths. */
	var css = szemCss();

	function meres(szelesseg) {
		var keret = document.createElement('iframe');
		keret.style.cssText = 'position:absolute; left:-9999px; top:0; height:700px; border:0; width:' + szelesseg + 'px;';
		document.body.appendChild(keret);
		var d = keret.contentDocument;
		d.open();
		d.write('<!doctype html><html><head><style>' + css + '</style></head><body>' +
		        '<div class="left-background"></div><div class="right-background"></div>' +
		        '<div class="fej"><table width="100%"><tr><td id="fejresz"><h1>Szem</h1></td>' +
		        '<td id="sugo"></td></tr></table></div>' +
		        '<div id="content"><table class="menuitem" width="1024px"><tbody><tr><td>' +
		        '<h1>Farmol\u00f3</h1></td></tr></tbody></table></div>' +
		        '</body></html>');
		d.close();
		function r(sel) {
			var e = d.querySelector(sel).getBoundingClientRect();
			return { bal: Math.round(e.left), jobb: Math.round(e.right) };
		}
		var m = {
			lap: d.documentElement.clientWidth,
			tulcsordul: d.documentElement.scrollWidth > d.documentElement.clientWidth,
			fej: r('.fej'), content: r('#content'), panel: r('#content table.menuitem'),
			bal: r('.left-background'), jobb: r('.right-background')
		};
		keret.remove();
		return m;
	}

	/* Wider than the maximum, around it, and well under the old fixed 1024 --
	   the last of which is where the old layout broke. */
	[1600, 1280, 1100, 900, 700].forEach(function (w) {
		var m = meres(w);
		var cimke = 'at ' + w + 'px';

		ok(!m.tulcsordul, cimke + ': nothing runs off the side of the screen');

		eq(m.fej.bal, m.content.bal, cimke + ': the header starts where the content does');
		eq(m.fej.jobb, m.content.jobb, cimke + ': and ends where it does');

		/* The panel fills its column exactly -- it is still built carrying
		   width="1024px", so this is what proves the rule reaches it. */
		eq(m.panel.bal, m.content.bal, cimke + ': the panel fills the column');
		eq(m.panel.jobb, m.content.jobb, cimke + ': right out to its edge');

		/* No seam and no overlap where the wallpaper meets the content. */
		eq(m.bal.bal, 0, cimke + ': the left wallpaper starts at the screen edge');
		eq(m.bal.jobb, m.content.bal, cimke + ': and runs up to the content');
		eq(m.jobb.bal, m.content.jobb, cimke + ': the right one starts where the content ends');
		eq(m.jobb.jobb, m.lap, cimke + ': and runs to the other edge');
	});

	/* The maximum is a maximum: a very wide window must not stretch the
	   column to match it. */
	var szeles = meres(1600);
	ok(szeles.content.jobb - szeles.content.bal <= 1280,
	   'a wide window leaves the column at its comfortable maximum',
	   (szeles.content.jobb - szeles.content.bal) + 'px');
	ok(szeles.content.bal > 0, 'centred rather than pinned to one side');

	/* And half of it is not written down a second time anywhere. */
	var szabalyok = szemCssRules();
	eq(szabalyok.indexOf('50vw - 512px'), -1, 'the panes are no longer half of a number spelled twice');
	eq(szabalyok.indexOf('width: 1024px'), -1, 'and the column width is not a literal any more');
});

/* ------------------------------------------------------------------------ */
suite('The default background', function () {
	/* The wallpaper feature stays exactly as it was -- put a link in the box
	   and it appears. What changed is what is in the box to begin with: it
	   used to be the artwork out of the upstream repository, which is not a
	   neutral thing to ship. */
	var api = sandbox({}, [sliceFn(SZEM4_SRC, 'setWallpaper')]);

	function panel() { return { style: { backgroundImage: 'url("regi.jpg")' } }; }

	/* "-" is how the rest of the style settings spell "nothing here", and the
	   help text beside these boxes already promised the background colour
	   would be used when there was no picture. It never was: "-" went
	   straight into url('-'), a request for a file called "-". */
	var p = panel();
	api.setWallpaper(p, '-');
	eq(p.style.backgroundImage, '', 'a dash clears the wallpaper instead of asking for a file called "-"');

	p = panel();
	api.setWallpaper(p, '');
	eq(p.style.backgroundImage, '', 'and so does an empty box');

	/* The feature itself, unchanged. */
	p = panel();
	api.setWallpaper(p, 'https://example.invalid/kep.jpg');
	eq(p.style.backgroundImage, "url('https://example.invalid/kep.jpg')",
	   'a link still becomes the wallpaper');

	api.setWallpaper(null, '-');   /* must not throw */
	ok(true, 'and a missing pane is not an error');

	/* What the boxes start on. */
	function boxDefault(nev) {
		var m = SZEM4_SRC.match(new RegExp('name="' + nev + '" value="([^"]*)"'));
		return m ? m[1] : '(nincs)';
	}
	eq(boxDefault('wallp_left'), '-', 'the left wallpaper box ships empty');
	eq(boxDefault('wallp_right'), '-', 'and the right one');
	eq(SZEM4_SRC.indexOf('default_bg_left.jpg') === -1 &&
	   SZEM4_SRC.indexOf('default_bg_right.jpg') === -1, false,
	   'the old art is still named -- but only where it is being moved away from');

	/* ...which is the point: an install that already has the artwork saved
	   must move on too, or the neutral default never actually ships. */
	var mig = sandbox({}, [sliceFrom(SZEM4_SRC, 'var REGI_STILUS_ALAP', 'upgradeStyleDefaults')]);
	var PIC = 'https://raw.githubusercontent.com/cncDAni2/klanhaboru/main/images/szem4/';
	var s = { profile1: { wallp_left: PIC + 'default_bg_left.jpg',
	                      wallp_right: PIC + 'default_bg_right.jpg' } };
	eq(mig.upgradeStyleDefaults(s), 2, 'both old wallpapers are moved on');
	eq(s.profile1.wallp_left, '-', 'the left one to nothing');
	eq(s.profile1.wallp_right, '-', 'and the right one');

	/* A wallpaper that was actually chosen is not a default. */
	var sajat = { profile1: { wallp_left: 'https://example.invalid/sajat.jpg' } };
	eq(mig.upgradeStyleDefaults(sajat), 0, 'a chosen wallpaper is left alone');
	eq(sajat.profile1.wallp_left, 'https://example.invalid/sajat.jpg', 'exactly as it was');

	/* The panes have to be part of the page when empty, or a neutral default
	   is just a hole either side of the content. */
	ok(szemCssRules().indexOf('.left-background, .right-background {') !== -1,
	   'and the empty panes are painted rather than left blank');
});

/* ------------------------------------------------------------------------ */
suite('The version', function () {
	/* It was written out twice -- once as VERZIO and once, as a bare number,
	   inside the startup line -- so bumping one and forgetting the other left
	   the log announcing a version that was not the one running. */
	var m = SZEM4_SRC.match(/var VERZIO_SZAM = '([^']+)';/);
	ok(!!m, 'there is one version number');
	var szam = m ? m[1] : '';

	ok(SZEM4_SRC.indexOf("var VERZIO = 'v' + VERZIO_SZAM + ' by elbeezy';") !== -1,
	   'and the full version string is built from it');

	ok(SZEM4_SRC.indexOf('"SZEM "+VERZIO_SZAM+" elindult."') !== -1,
	   'the startup line is built from it too, not typed again');

	/* Nothing anywhere still names an older one. */
	var kod = stripComments(SZEM4_SRC);
	eq(kod.indexOf('4.7'), -1, 'no 4.7 left anywhere in the script', szam);
	eq(szam, '4.8', 'and the version is 4.8', szam);
});

/* ------------------------------------------------------------------------ */
suite('The Banyak cell', function () {
	/* The three mine levels now sit behind the game's own building icons. The
	   catch is that this cell's text is a contract, not a label: addWagons()
	   reads cells[1].textContent straight back and getProdHour() splits it on
	   commas, expecting three numbers. That is how hourly production -- and
	   from it every loot estimate and every target choice -- is worked out.

	   So this is tested by round trip: build the cell, read its text back out
	   of a real DOM, and put it through the real getProdHour. */
	var api = sandbox({
		TERMELES: [5, 30, 35, 41, 47, 55, 64, 74, 86, 100, 117, 136, 158, 184, 214, 249, 289],
		SPEED: 1,
		document: document
	}, [sliceFn(SZEM4_SRC, 'banyakCella'), sliceFn(SZEM4_SRC, 'picBuilding'),
	    sliceFn(SZEM4_SRC, 'getProdHour')]);

	function szoveg(html) {
		var el = document.createElement('td');
		el.innerHTML = html;
		return el;
	}

	var cella = szoveg(api.banyakCella(3, 3, 2));
	eq(cella.textContent, '3,3,2', 'the cell still reads as three numbers and two commas');
	eq(cella.querySelectorAll('img').length, 3, 'with an icon in front of each one');

	/* The icons must contribute no text of their own, or the split breaks. */
	eq(cella.textContent.split(',').length, 3, 'which splits into exactly three parts');

	/* The number that actually matters. */
	eq(api.getProdHour(cella.textContent), api.getProdHour('3,3,2'),
	   'production off the rendered cell matches production off the raw levels');

	/* Two digits per mine is where a sloppier separator would show up. */
	var nagy = szoveg(api.banyakCella(12, 10, 11));
	eq(nagy.textContent, '12,10,11', 'two-digit levels survive too');
	eq(api.getProdHour(nagy.textContent), api.getProdHour('12,10,11'), 'and still price correctly');

	/* The commas are only made invisible. Removing them would leave
	   getProdHour() with one number and silently wrong production everywhere. */
	ok(SZEM4_SRC.indexOf('szem4_banya_vesszo') !== -1, 'the separators are real characters in the markup');
	ok(szemCssRules().indexOf('font-size: 0;') !== -1, 'that are hidden by size, not deleted');

	/* Both places that write this cell go through the one helper -- they had
	   drifted apart before, one building a string and one assigning an array. */
	/* Scoped to the farm table on purpose: three other cells[1].innerHTML in
	   the file belong to the incoming-attacks and builder-group tables. */
	ok(SZEM4_SRC.indexOf('farm_helye.cells[1].innerHTML = banyakCella(') !== -1,
	   'the spy report writes the cell through the helper');
	ok(SZEM4_SRC.indexOf('c.innerHTML = banyakCella(') !== -1,
	   'and so does the rebuild');
	eq(SZEM4_SRC.split('banyakCella(').length - 1, 3,
	   'the helper is defined once and called by exactly those two');
});

/* ------------------------------------------------------------------------ */
suite('The module buttons', function () {
	/* These were two PNGs pulled from the upstream repository, so they could
	   never match the palette. They are drawn now, from the tokens, at the
	   moment of drawing -- so the accent reaches them instead of being
	   duplicated in an image nobody can edit.

	   Run inside an iframe carrying the real stylesheet, because the whole
	   point is that the colours are read off :root. */
	var keret = palettasKeret();
	var ikon = ikonApi(keret.contentWindow).modulIkon;

	var fut = ikon(false), all = ikon(true);
	ok(fut.indexOf('data:image/svg+xml,') === 0, 'a running module gets a drawn icon, not a fetched one');
	ok(all.indexOf('data:image/svg+xml,') === 0, 'and so does a stopped one');
	ok(fut !== all, 'and the two states do not look the same');

	/* The accent is what marks a module as running. */
	var accent = szemCss().match(/--szem-accent:\s*([^;]+);/)[1].trim();
	ok(decodeURIComponent(fut).indexOf(accent) !== -1,
	   'a running module is drawn in the accent colour', accent);
	ok(decodeURIComponent(all).indexOf(accent) === -1,
	   'a stopped one is not, so the bar shows at a glance what is live');

	/* Shape: a triangle for running, two bars for stopped. */
	ok(decodeURIComponent(fut).indexOf('<path') !== -1, 'running is a triangle');
	eq((decodeURIComponent(all).match(/<rect/g) || []).length, 3,
	   'stopped is the badge plus two bars');

	/* It has to survive a page where the tokens are missing rather than
	   drawing something invisible. */
	var puszta = document.createElement('iframe');
	puszta.style.cssText = 'position:absolute; left:-9999px; width:100px; height:100px;';
	document.body.appendChild(puszta);
	puszta.contentDocument.open();
	puszta.contentDocument.write('<!doctype html><html><head></head><body></body></html>');
	puszta.contentDocument.close();
	var tartalek = ikonApi(puszta.contentWindow).modulIkon(false);
	ok(tartalek.indexOf('data:image/svg+xml,') === 0 && decodeURIComponent(tartalek).indexOf('#') !== -1,
	   'with no palette at all it still draws something visible');
	puszta.remove();
	keret.remove();

	/* The element stays an <img> whose src is swapped. Two places find it with
	   #kiegs img[name="..."], and szunet() is handed it by the inline handler,
	   so turning it into anything else would break the pause toggle. */
	ok(SZEM4_SRC.indexOf('#kiegs img[name="\' + script + \'"]') !== -1,
	   'the pause toggle still finds the button as an img');
	ok(SZEM4_SRC.indexOf('kep.src   = modulIkon(paused);') !== -1,
	   'and still swaps it by src');
	ok(SZEM4_SRC.indexOf('src="\'+modulIkon(startsPaused.includes(id))+\'"') !== -1,
	   'the bar is built with the same drawing');

	/* And nothing fetches the old artwork any more. */
	eq(SZEM4_SRC.indexOf('play.png'), -1, 'no play.png is fetched');
	eq(SZEM4_SRC.indexOf('pause.png'), -1, 'and no pause.png');

	/* The preview draws them with the real function rather than a lookalike. */
	ok(PREVIEW_SRC.indexOf('modulIkonBetolt') !== -1 && PREVIEW_SRC.indexOf('play.png') === -1,
	   'and the preview shows the same buttons the interface makes');
});

/* ------------------------------------------------------------------------ */
suite('The stop control', function () {
	/* "Szünet mind" was the widest thing in the module bar and the reason it
	   spilled onto a second line. It is a red octagon now -- the one place the
	   palette's danger colour is used, so it reads as the odd one out on
	   purpose, while being drawn at the same size and in the same way as the
	   module buttons so the bar still looks like one set of controls. */
	var keret = palettasKeret();
	var stop = ikonApi(keret.contentWindow).stopIkon();
	ok(stop.indexOf('data:image/svg+xml,') === 0, 'the stop sign is drawn, not fetched');

	var piros = szemCss().match(/--szem-danger:\s*([^;]+);/)[1].trim();
	ok(decodeURIComponent(stop).indexOf(piros) !== -1, 'and drawn in the danger colour', piros);
	ok(decodeURIComponent(stop).indexOf('<polygon') !== -1, 'as an octagon rather than another badge');

	/* It must not borrow the accent, or it stops standing out. */
	var accent = szemCss().match(/--szem-accent:\s*([^;]+);/)[1].trim();
	eq(decodeURIComponent(stop).indexOf(accent), -1, 'and never in the accent colour');
	keret.remove();

	/* The countdown moved into its own span: the link carries the icon, and
	   writing over the link's text would take the icon with it. */
	ok(SZEM4_SRC.indexOf('id="szunet_mind_ido"') !== -1, 'there is a span for the countdown');
	ok(SZEM4_SRC.indexOf("var ido = document.getElementById('szunet_mind_ido');") !== -1,
	   'and the countdown is written into it');
	eq(SZEM4_SRC.indexOf("el.textContent = 'Sz\u00fcnet mind'"), -1,
	   'nothing writes over the link itself any more');

	/* The bar is one control lighter, which is what bought the room. */
	eq(SZEM4_SRC.indexOf('muhely_logo'), -1, "upstream's workshop icon is gone");
	ok(PREVIEW_SRC.indexOf('muhely_logo') === -1 && PREVIEW_SRC.indexOf('stopIkon') !== -1,
	   'and the preview shows the same bar');
});

/* ------------------------------------------------------------------------ */
suite('The module bar stays on one line', function () {
	/* Six module names, two of them long, plus the stop control and the three
	   links on the right. This spilled onto a second line in the real game and
	   the second line sat on top of what was below it.

	   Whether it fits is a question about rendered text at a given width, so
	   the bar is built for real at several widths and the rows are counted. */
	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; top:0; height:200px; border:0;';
	document.body.appendChild(keret);

	function sorok(szelesseg) {
		keret.style.width = szelesseg + 'px';
		var d = keret.contentDocument;
		d.open();
		d.write('<!doctype html><html><head><style>' + szemCss() + '</style></head><body>' +
			'<div class="fej"><table width="100%"><tr><td colspan="2" id="menuk">' +
			'<div class="divrow menubar"><span class="divcell" id="kiegs">' +
			'<a href="#" id="szunet_mind"><img alt="stop"><span id="szunet_mind_ido"></span></a>' +
			'<img name="kh">' +
			['farm|FARMOL\u00d3', 'vije|JELENT\u00c9S ELEMZ\u0150', 'idtamad|BEJ\u00d6V\u0150 T\u00c1MAD\u00c1SOK',
			 'epit|\u00c9P\u00cdT\u0150', 'gyujto|GY\u0170JT\u0150', 'adatok|ADATMENT\u0150'].map(function (m) {
				var r = m.split('|');
				return '<img name="' + r[0] + '"> <a href="#">' + r[1] + '</a> ';
			}).join('') +
			'</span><span class="divcell menubar_jobb">' +
			'<a href="#">Napl\u00f3</a><a href="#">Debug</a><a href="#"><img alt="hang"></a>' +
			'</span></div></td></tr></table></div></body></html>');
		d.close();
		var linkek = [].slice.call(d.querySelectorAll('#kiegs a')).filter(function (a) {
			return a.id !== 'szunet_mind';
		});
		var tetok = {};
		linkek.forEach(function (a) { tetok[Math.round(a.getBoundingClientRect().top)] = 1; });
		return Object.keys(tetok).length;
	}

	/* 1024 was the old fixed width and is the narrowest thing this has ever
	   been used at; 900 is comfortably below any real window. */
	[1600, 1280, 1100, 1024, 900].forEach(function (w) {
		eq(sorok(w), 1, 'the bar is one line at ' + w + 'px');
	});

	keret.remove();

	/* Wrapping is still what happens when it truly cannot fit -- overflowing
	   would put the controls off the side of the screen instead. */
	ok(szemCssRules().indexOf('flex-wrap: wrap;') !== -1,
	   'and it wraps rather than overflowing if it ever cannot fit');
});

/* ------------------------------------------------------------------------ */
suite("SZEM's own icons", function () {
	/* The interface pulled fifteen small PNGs out of upstream's image folder.
	   Being pictures they could not follow the palette, they were drawn by
	   different hands, and each cost a request. The ones that belong to SZEM
	   rather than to the game are drawn now; anything depicting something in
	   the game still uses the game's own artwork, which is the look these are
	   meant to sit beside. */
	var keret = palettasKeret();
	var api = ikonApi(keret.contentWindow);

	var halvany = szemCss().match(/--szem-text-dim:\s*([^;]+);/)[1].trim();
	var piros = szemCss().match(/--szem-danger:\s*([^;]+);/)[1].trim();

	['search', 'heart', 'hang', 'pihen', 'plus', 'del', 'link', 'load', 'mentes',
	 'import', 'export', 'cloud', 'reset', 'sebesseg', 'mozdony',
	 'beallitasok'].forEach(function (nev) {
		var d = api.szemIkon(nev);
		ok(d.indexOf('data:image/svg+xml,') === 0, nev + ' is drawn rather than fetched');
		var dec = decodeURIComponent(d);
		ok(dec.indexOf('<svg') !== -1 && dec.indexOf('</svg>') !== -1,
		   'and is a real drawing', nev);
	});

	/* The heartbeat is the one that means "alive", so it keeps the danger
	   colour; the other two are quiet furniture and must not shout. */
	ok(decodeURIComponent(api.szemIkon('heart')).indexOf(piros) !== -1,
	   'the heartbeat is drawn in the danger colour');
	ok(decodeURIComponent(api.szemIkon('search')).indexOf(halvany) !== -1,
	   'the magnifier is drawn in the quiet colour');
	ok(decodeURIComponent(api.szemIkon('hang')).indexOf(piros) === -1,
	   'and the sound icon does not shout');

	/* The waiting indicator sits in an element the stylesheet spins, so it has
	   to be a shape that reads as motion: a full track with one bright arc on
	   it. The accent is what makes the arc findable against the track, and the
	   track is what makes it a spinner rather than a dot going in circles. */
	var ekes = szemCss().match(/--szem-accent:\s*([^;]+);/)[1].trim();
	var pihen = decodeURIComponent(api.szemIkon('pihen'));
	ok(pihen.indexOf(ekes) !== -1, 'the waiting indicator is drawn in the accent');
	ok(pihen.indexOf(halvany) !== -1, 'over a track in the quiet colour');
	ok(/#global_notifications img\.rotate\s*\{[^}]*animation:/.test(szemCssRules()),
	   'and the element it goes in is still the one that spins');

	eq(api.szemIkon('nincsilyen'), '', 'an unknown name draws nothing rather than a broken image');
	keret.remove();

	/* The artwork these replaced is gone from the source entirely -- a stray
	   pic("search.png") would fetch a picture that no longer matches. */
	['search.png', 'heart.png', 'hang.png', 'play.png', 'pause.png',
	 'muhely_logo.png', 'freeze.png', 'plus.png', 'del.png', 'link.png',
	 'load.png', 'saveNow.png', 'Import.png', 'Export.png', 'cloud.png',
	 'reset.png', 'sebesseg.png', 'mozdony.png',
	 'beallitasok.png'].forEach(function (f) {
		eq(SZEM4_SRC.indexOf(f), -1, f + ' is no longer fetched');
	});

	/* The other half of the rule, and the half that is easy to lose: artwork
	   depicting something IN the game stays the game's own. Drawing those
	   from the palette would make SZEM's idea of a resource pile sit next to
	   the game's actual one, two pictures of the same thing that do not
	   match. Asserted so that "finish the icons" does not quietly take them
	   as well. */
	['resource.png', 'kh_logo.png'].forEach(function (f) {
		ok(SZEM4_SRC.indexOf("pic('" + f + "')") !== -1 || SZEM4_SRC.indexOf('pic("' + f + '")') !== -1,
		   f + ' still uses the artwork, because it depicts the game rather than SZEM');
	});

	/* Counted, not just looked for.

	   The presence check above passes as long as ONE call survives, and
	   resource.png is fetched twice -- so converting one of the two left it
	   green. Pinning the total means taking any of them still fails. A
	   genuinely new game-art fetch has to move this number, which is the
	   point: it should be a deliberate step, not a silent one. */
	eq((SZEM4_SRC.match(/pic\(['"]/g) || []).length, 3,
	   'exactly three pictures are still named outright');

	/* And one more that is not named outright at all. The farm's Szerelvények
	   column picks between wagon_normal, wagon_coal, wagon_nuclear and
	   wagon_empty at runtime, so it reads pic(wagonType) and no search for a
	   filename finds it -- which is how it stayed off the list of remaining
	   artwork while that list was being worked through. Those four depict
	   cargo the game itself draws, so they stay; asserted here so the next
	   count of "what is left" starts from the truth. */
	ok(SZEM4_SRC.indexOf('pic(wagonType)') !== -1,
	   'the wagons are still the game artwork, chosen by a variable rather than named');

	/* One palette lookup and one SVG wrapper for all of them: this was three
	   copies of the same four lines before the third caller arrived. */
	eq(SZEM4_SRC.split('getComputedStyle(document.documentElement)').length - 1, 1,
	   'the palette is read in exactly one place');
});


/* --------------------------------------------------------------- epitesi sor
   Read off his saved build page (Building.htm), not imagined: the queue is a
   <tbody id="buildqueue"> whose first row is the <th> header, whose orders
   carry class="... buildorder_<id>" and a .webp building picture, and between
   the orders sits a progress-bar row -- one colspan cell, no image at all.
   That row and the .webp are exactly what broke the old filename parse, so
   the fixture keeps both. */
function queueRow(html, cls) {
	var tr = document.createElement('tr');
	if (cls) tr.className = cls;
	tr.innerHTML = html;
	return tr;
}
function buildQueueEl(rows) {
	var table = document.createElement('table');
	var tbody = document.createElement('tbody');
	tbody.id = 'buildqueue';
	tbody.appendChild(queueRow('<th>Építés</th><th>Időtartam</th><th>Sebesség</th><th>Elkészül</th><th>Törlés</th><th></th>'));
	rows.forEach(function (r) { tbody.appendChild(r); });
	table.appendChild(tbody);
	return tbody;
}
/* An order exactly as the game writes it, .webp picture included. */
function orderRow(id, ido, kep) {
	return queueRow(
		'<td class="lit-item"><img src="https://dshu.innogamescdn.com/asset/db281c7a/graphic/buildings/mid/' +
		(kep || id + '2.webp') + '" title="x" class="bmain_list_img" />' + id + '<br />19. szint</td>' +
		'<td class="nowrap lit-item"><span class="timer">' + ido + '</span></td>' +
		'<td class="lit-item"></td><td class="lit-item">ma ekkor: 13:33:21</td>' +
		'<td class="lit-item"><a class="btn btn-cancel">Visszavonás</a></td>',
		'lit nodrag buildorder_' + id);
}
/* The progress bar the game inserts under the order it is currently working
   on. One cell, spanning five, holding a div -- no image anywhere. */
function progressRow() {
	return queueRow('<td colspan="5" class="order-progress-cell"><div class="order-progress"></div></td>', 'lit');
}

suite('epito -- az epitesi sor kiolvasasa', function () {
	function api(naplo) {
		return sandbox({ debug: function (a, b) { if (naplo) naplo.push(String(b)); } },
		               [sliceFn(SZEM4_SRC, 'queueRowMinutes'), sliceFn(SZEM4_SRC, 'readBuildQueue')]);
	}

	/* The whole bug, in one assertion. This exact shape -- order, progress,
	   order, order -- is what his overnight log was failing on, four rows
	   reported every pass. */
	var sor = buildQueueEl([orderRow('iron', '0:40:41'), progressRow(),
	                        orderRow('stone', '1:00:00'), orderRow('farm', '0:30:00')]);
	var hibak = [];
	var r = api(hibak).readBuildQueue(sor);
	eq(r.list, 'iron;stone;farm;', 'every queued building is read, in order');
	eq(hibak, [], 'and nothing is reported as a failure');

	/* The times, so that "how long until the queue frees up" is right again.
	   40:41 -> 40.68 perc, plus an hour, plus a half hour. */
	eq(Math.round(r.allBuildTime), 131, 'the whole queue is 131 minutes');
	eq(Math.ceil(r.firstBuildTime), 41, 'the first building has 41 minutes left');

	/* The progress row is skipped in silence. It is not an order and it is
	   not a fault; reporting it is what filled his log all night. */
	var csak = buildQueueEl([progressRow()]);
	var h2 = [];
	eq(api(h2).readBuildQueue(csak).list, '', 'a queue of nothing but a progress row reads as empty');
	eq(h2, [], 'and stays quiet about it');

	/* Mutation test for the .webp cause: the picture is now irrelevant, so
	   the same row with the old .png name -- or with no picture at all --
	   must still read. If this ever goes back to parsing the filename, the
	   no-picture case fails immediately. */
	eq(api().readBuildQueue(buildQueueEl([orderRow('wood', '0:10:00', 'wood1.png')])).list,
	   'wood;', 'a .png picture reads the same way');
	var kepNelkul = queueRow('<td class="lit-item">fa</td><td><span>0:10:00</span></td>',
	                         'lit buildorder_wood');
	eq(api().readBuildQueue(buildQueueEl([kepNelkul])).list, 'wood;',
	   'and a row with no picture at all still reads');

	/* A building whose clock cannot be read is still a building that is
	   queued. Getting this wrong is worse than a short time estimate: the
	   builder adds the queued levels to the current ones to decide what to
	   raise next, so dropping one makes it queue the same building twice. */
	var romlott = queueRow('<td class="lit-item">x</td><td class="nowrap"><span class="timer"></span></td>',
	                       'lit nodrag buildorder_main');
	var h3 = [];
	var r3 = api(h3).readBuildQueue(buildQueueEl([romlott, orderRow('barracks', '0:20:00')]));
	eq(r3.list, 'main;barracks;', 'an unreadable clock still leaves the building on the list');
	eq(h3.length, 1, 'and reports exactly that one row');
	ok(h3[0].indexOf('1. sor') !== -1, 'naming the row it could not read');

	/* Two names must never run together. Before the fix the name and its
	   semicolon were appended on either side of the time parse, so a row
	   that threw in between produced "mainbarracks" -- a building nothing
	   matches, silently costing both entries. */
	ok(r3.list.indexOf('mainbarracks') === -1, 'a failed row cannot glue two names together');

	/* The header row is not an order. */
	eq(api().readBuildQueue(buildQueueEl([])).list, '', 'an empty queue reads as empty');

	/* The order row also carries id="buildorder_1", and the page has a
	   buildorder_reorder URL in a script -- neither names a building. The
	   class attribute is the only thing read, so a row carrying the id but
	   no buildorder_ class must contribute nothing. Written this way round
	   deliberately: asserting it on a row that HAS the class would pass even
	   if the id were being read too. */
	var csakId = queueRow('<td class="lit-item">k</td><td><span>0:05:00</span></td>', 'sortable_row');
	csakId.id = 'buildorder_1';
	eq(api().readBuildQueue(buildQueueEl([csakId])).list, '',
	   'the row id buildorder_1 is not mistaken for a building');
});


suite('epito -- a kovetkezo ellenorzes ideje', function () {
	/* A deliberately awkward clock: 7 minutes past the hour and 45 seconds in,
	   so that using the minute field where the second field was meant lands on
	   a visibly different time rather than coincidentally the right one. */
	var most = new Date(2026, 8, 7, 13, 7, 45);
	function api() {
		return sandbox({ getServerTime: function () { return new Date(most.getTime()); },
		                 debug: function () {} },
		               [sliceFn(SZEM4_SRC, 'szem4_EPITO_addIdo')]);
	}
	function sor() { return { cells: [fakeEl(''), fakeEl(''), fakeEl('')] }; }
	function varas(perc) {
		var r = sor();
		api().szem4_EPITO_addIdo(r, perc);
		return r.cells[2].innerHTML;
	}
	function ekkor(perc) { return new Date(most.getTime() + perc * 60000).toLocaleString(); }

	/* The whole point: 30 minutes from 13:07:45 is 13:37:45. Reading the
	   minute field instead of the second field gave 13:37:07 -- close enough
	   to look right in the interface and never be noticed. */
	eq(varas(30), ekkor(30), 'half an hour later is exactly half an hour later');
	eq(varas(5), ekkor(5), 'and five minutes later is five minutes later');
	eq(varas(120), ekkor(120), 'two hours later crosses the hour correctly');

	/* The seconds must survive. This is the assertion the old code fails. */
	ok(varas(30).indexOf('45') !== -1 || ekkor(30).indexOf('45') === -1,
	   'the seconds of the current time are carried over, not discarded');

	/* Substitutions, kept because the builder hands 0 through whenever it
	   could not read a remaining time -- which is precisely what happened
	   while the build queue was unreadable. */
	eq(varas(0), ekkor(30), 'no known time means look again in half an hour');
	eq(varas(NaN), ekkor(5), 'an unusable time means look again in five minutes');

	/* "del" removes the village's row instead of scheduling anything. */
	var torolt = [];
	var vilag = { getServerTime: function () { return new Date(most.getTime()); },
	              debug: function () {},
	              document: { getElementById: function () { return { deleteRow: function (i) { torolt.push(i); } }; } } };
	sandbox(vilag, [sliceFn(SZEM4_SRC, 'szem4_EPITO_addIdo')])
		.szem4_EPITO_addIdo({ rowIndex: 4, cells: [fakeEl(''), fakeEl(''), fakeEl('')] }, 'del');
	eq(torolt, [4], 'a finished village has its row deleted');
});


suite('epito -- a hatralevo ido forrasa', function () {
	function api(naplo) {
		return sandbox({ debug: function (a, b) { if (naplo) naplo.push(String(b)); } },
		               [sliceFn(SZEM4_SRC, 'queueRowMinutes'), sliceFn(SZEM4_SRC, 'readBuildQueue')]);
	}
	function cella(html) {
		var td = document.createElement('td');
		td.innerHTML = html;
		return td;
	}
	var most = 1788690000000;   /* ms; a mentett lap data-endtime-jaihoz igazitva */

	/* The row that is actually building carries data-endtime and an EMPTY
	   span -- the game's own script paints the countdown in afterwards. This
	   is the case that used to read as nothing at all if SZEM looked first. */
	eq(Math.round(api().queueRowMinutes(cella('<span class="timer" data-endtime="1788694401"></span>'), most)),
	   73, 'an unpainted countdown still yields its remaining time');

	/* And it keeps working once the game has painted it -- the attribute is
	   still the thing read, so the answer does not change halfway. */
	eq(Math.round(api().queueRowMinutes(cella('<span class="timer" data-endtime="1788694401">1:13:21</span>'), most)),
	   73, 'a painted countdown gives the same answer, from the same source');

	/* A queued order that has not started has no data-endtime at all: it
	   states its own duration as text. That branch must stay. */
	eq(api().queueRowMinutes(cella('<span>2:04:27</span>'), most), 124.45,
	   'a queued order still reads its duration from the text');

	/* An order on the point of finishing must not go negative -- a negative
	   wait would schedule the builder's next look in the past. */
	eq(api().queueRowMinutes(cella('<span class="timer" data-endtime="1788689000"></span>'), most), 0,
	   'an order already due reads as no time left, never a negative one');

	/* End to end, on the shape of his real page: countdown row, progress bar,
	   queued row. 73 minutes remaining plus a 124.45 minute order. */
	var sor = buildQueueEl([
		queueRow('<td class="lit-item">v</td><td class="nowrap lit-item"><span class="timer" data-endtime="1788694401"></span></td>',
		         'lit nodrag buildorder_iron'),
		progressRow(),
		queueRow('<td class="lit-item">k</td><td class="lit-item"><span>2:04:27</span></td>',
		         'sortable_row buildorder_stone')]);
	var hibak = [];
	var r = api(hibak).readBuildQueue(sor, most);
	eq(r.list, 'iron;stone;', 'both orders are read');
	eq(Math.round(r.allBuildTime), 198, 'the queue frees up in 198 minutes');
	eq(Math.ceil(r.firstBuildTime), 74, 'and the first order has 74 minutes to run');
	eq(hibak, [], 'with nothing reported');

	/* Without an injected clock it falls back to the real one, so the
	   parameter is a test seam and not a new thing the caller must supply. */
	ok(api().readBuildQueue(sor).allBuildTime > 0, 'the clock defaults to the real one');
});


/* ------------------------------------------------------------------------ */
suite('epito -- az Info oszlop allapotszinei', function () {
	/* He reported the yellow "Nyersanyaghiány" cell as unreadable: the cell
	   painted its background and left the text at the table's pale grey.

	   Asserting which tokens were named would not catch that -- the old code
	   named a perfectly good yellow. What matters is whether the pair can be
	   read, so the browser is asked what it computed and the ratio worked out
	   from it, the same way the header colours are checked. */
	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; top:0; width:800px; height:400px;';
	document.body.appendChild(keret);
	var d = keret.contentDocument;
	d.open();
	d.write('<!doctype html><html><head><style>' + szemCss() + '</style></head><body>' +
	        '<div id="content"><table class="vis"><tbody><tr>' +
	        '<td id="c0">Capital | 001 (524|463)</td><td id="c1">l</td><td id="c2">t</td>' +
	        '<td id="c3">info</td></tr></tbody></table></div></body></html>');
	d.close();

	function fenyero(s) {
		var c = s.match(/[0-9.]+/g).slice(0, 3).map(function (v) {
			v = Number(v) / 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	}
	function kontraszt(a, b) {
		var la = fenyero(a), lb = fenyero(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	}

	var sor = d.getElementById('c3').parentNode;
	var api = sandbox({ JELZO_NINCS: '', debug: function () {},
	                    KTID: { '524|463': 1 }, setTimeout: function () {},
	                    playSound: function () {},
	                    gameUrl: function () { return '#'; },
	                    szemIkon: function () { return 'i.svg'; },
	                    JELZO_SZINEK: { alap: '', yellow: 'var(--szem-warn)',
	                                    blue: 'var(--szem-stalled)', red: 'var(--szem-danger)' } },
	                  [sliceFn(SZEM4_SRC, 'szem4_EPITO_infoCell')]);

	function fest(szin) {
		api.szem4_EPITO_infoCell(sor, szin, 'Nyersanyaghiány lépett fel.');
		var cs = keret.contentWindow.getComputedStyle(d.getElementById('c3'));
		return { hatter: cs.backgroundColor, szoveg: cs.color };
	}

	['yellow', 'blue', 'red'].forEach(function (szin) {
		var v = fest(szin);
		ok(v.hatter !== 'rgba(0, 0, 0, 0)', szin + ': the cell actually paints a background', v.hatter);
		ok(kontraszt(v.hatter, v.szoveg) >= 4.5,
		   szin + ': and its message can be read on it',
		   kontraszt(v.hatter, v.szoveg).toFixed(2) + ':1');
	});

	/* The three states must stay apart from each other, or the colour stops
	   carrying the meaning the header tooltip promises. */
	var sarga = fest('yellow').hatter, kek = fest('blue').hatter, piros = fest('red').hatter;
	ok(sarga !== kek && kek !== piros && sarga !== piros,
	   'the three states are three different colours');

	/* And apart from the header amber, so a warning never reads as a heading.
	   The accent is read off the sheet rather than repeated as a hex here. */
	var proba = d.createElement('div');
	proba.style.color = 'var(--szem-accent)';
	d.body.appendChild(proba);
	var accent = keret.contentWindow.getComputedStyle(proba).color;
	ok(sarga !== accent, 'the warning yellow is not the header amber');
	proba.remove();

	/* "alap" means nothing is wrong: the inline colours come off entirely and
	   the cell goes back to whatever the stylesheet says. Leaving a near-black
	   text colour behind here would make a normal row unreadable, which is the
	   reported bug with the colours the other way round. */
	var alap = fest('alap');
	eq(alap.hatter, 'rgba(0, 0, 0, 0)', 'a normal row paints no background of its own');
	eq(alap.szoveg, keret.contentWindow.getComputedStyle(d.getElementById('c2')).color,
	   'and its text is the same as any other cell in the table');

	keret.remove();
});


/* ------------------------------------------------------------------------ */
suite('epito -- a magyar szoveg', function () {
	/* Copy is not usually worth pinning, but these four were each wrong in a
	   way that reads as sloppiness in the one panel he looks at most, and a
	   later edit could reintroduce any of them without anyone noticing.

	   Written as counts and as comparisons between the two messages rather
	   than as "the good string is present somewhere" -- a presence check
	   passes while a second copy of the bad one survives, which is the trap
	   the resource.png count was rewritten to avoid. */
	var forras = stripComments(SZEM4_SRC);

	/* A compound noun, so it is one word. The spaced form must be gone
	   entirely, not merely outnumbered. */
	eq((forras.match(/Nyersanyag hi[áa]ny/g) || []).length, 0,
	   'the shortage message spells the compound as one word');
	eq((forras.match(/Nyersanyaghiány/g) || []).length, 1,
	   'and says so exactly once');

	/* Two routes reach the same condition -- the queue-full check up front,
	   and the hidden build button further down -- and they used to describe
	   it in two different words. The game calls it the építési sor. */
	eq((forras.match(/Építkezési/g) || []).length, 0,
	   'the queue is not called two different things');
	eq((forras.match(/Építési sor megtelt/g) || []).length, 2,
	   'both routes to a full queue say the same thing');

	/* The -e question particle takes a hyphen. */
	eq((forras.match(/lehet e /g) || []).length, 0, 'lehet-e is hyphenated');
	ok(forras.indexOf('lehet-e már építeni') !== -1, 'in the Return column tooltip');

	/* And a comma before hogy. */
	eq((forras.match(/jelentése hogy/g) || []).length, 0,
	   'the Infó tooltip has its comma before hogy');
	ok(forras.indexOf('jelentése, hogy nem tud haladni') !== -1, 'in the clause that needed it');

	/* Three more he picked out of the panel afterwards. Awkward rather than
	   misspelt, so they are pinned the same way: by counting the shape that
	   was wrong, which is the only check that notices a second copy. */

	/* Both error paths used the same strained adjective, and fixing one and
	   not the other would have recreated the two-names-for-one-thing problem
	   the queue message just lost. */
	eq((forras.match(/felvételekori/g) || []).length, 0,
	   'neither add-error message uses the strained adjective any more');
	eq((forras.match(/Hiba az új (falu\(k\)|csoport) felvételekor/g) || []).length, 2,
	   'and both say it the same way round');

	/* Colloquial, in a confirm box that deletes a group. */
	eq((forras.match(/Biztos kitörlöd/g) || []).length, 0, 'the delete prompt is not colloquial');
	ok(forras.indexOf('Biztosan törlöd a ') !== -1, 'it asks with Biztosan törlöd');

	/* The tooltip was missing its article, and offers a choice from several
	   lists, so the noun is plural. */
	ok(forras.indexOf('A felső táblázatban használt listák közül') !== -1,
	   'the list-column tooltip has its article and its plural');
	eq((forras.match(/Felső táblázatban használt lista közül/g) || []).length, 0,
	   'and the old singular is gone');
});


/* ------------------------------------------------- ingyenes befejezes
   Read off his saved page (Build que early finish.htm), captured with a
   build under three minutes so the free control was actually live. The
   in-progress order's third cell holds THREE anchors; the two on the right
   share the label "Befejezés", share the classes "order_feature btn btn-btr",
   and "btn-instant" is a substring of "btn-instant-free". Getting the wrong
   one costs 10 premium points per build, silently, so the fixture keeps all
   three exactly as the game writes them and every assertion below is really
   about telling them apart.

   The real numbers from that page: available-from 1788773320,
   available-to 1788773500, and the row's own data-endtime 1788773500 --
   i.e. the free window opens exactly 180 seconds before the build ends. */
var BEF_TOL = 1788773320, BEF_IG = 1788773500;

function instantCell(opts) {
	opts = opts || {};
	var szabad = opts.freeOnclick === undefined
		? "return BuildingMain.change_order(209230, 'BuildInstantFree', 0)"
		: opts.freeOnclick;
	var html =
		'<a class="order_feature btn btn-btr" onclick="return BuildingMain.change_order(209230, \'BuildTimeReduction\', 10)" href="#" data-available-from="0" data-available-to="1788772900" style="display: none">-50%</a>' +
		'<a class="order_feature btn btn-btr btn-instant" onclick="return BuildingMain.change_order(209230, \'BuildInstant\', 10)" href="#" data-available-from="1788772900" data-available-to="1788773320" style="display: none">Befejezés</a>';
	if (!opts.noFree) {
		html += '<a class="order_feature btn btn-btr btn-instant-free" onclick="' + szabad +
			'" href="#" data-available-from="' + (opts.tol === undefined ? BEF_TOL : opts.tol) +
			'" data-available-to="' + (opts.ig === undefined ? BEF_IG : opts.ig) + '">Befejezés</a>';
	}
	return html;
}

/* The order that is actually being built, with its live timer and its three
   buttons -- as opposed to orderRow() above, which is a plain queued order. */
function elonyRow(opts) {
	return queueRow(
		'<td class="lit-item"><img src="https://dshu.innogamescdn.com/asset/db281c7a/graphic/buildings/mid/iron3.webp" title="Vasbánya" class="bmain_list_img" /> Vasbánya<br /> 20. szint</td>' +
		'<td class="nowrap lit-item"><span class="timer" data-endtime="' + BEF_IG + '"></span></td>' +
		'<td class="lit-item">' + instantCell(opts) + '</td>' +
		'<td class="lit-item">ma ekkor: 11:31:40</td>' +
		'<td class="lit-item"><a class="btn btn-cancel">Visszavonás</a></td>',
		'lit nodrag buildorder_iron');
}

suite('auto befejezo -- az ingyenes ajanlat felismerese', function () {
	/* The whole block as source text, constants included, so the tests use
	   the real BEF_RATARTAS_MP rather than a copy of it. befejezesKattint
	   must stay the LAST function in the block or the others fall outside
	   the sandbox. */
	function api(naplo) {
		return sandbox({ naplo: function (a, b) { if (naplo) naplo.push(String(b)); } },
		               [sliceFrom(SZEM4_SRC, 'var BEF_RATARTAS_MP', 'befejezesKattint')]);
	}

	/* --- the hazard, first and at length ---------------------------------- */

	/* The fixture really does contain the paid button, so nothing below can
	   pass by accident on a page that simply has no trap in it. */
	var sor = buildQueueEl([elonyRow(), progressRow()]);
	ok(sor.querySelectorAll('.btn-instant').length === 1, 'the fixture contains the paid button');
	ok(sor.querySelectorAll('.btn-instant-free').length === 1, 'and the free one beside it');
	ok(sor.querySelectorAll('.order_feature').length === 3, 'all three order_feature buttons are present');

	var terv = api().befejezesTerv(sor, (BEF_TOL + 2) * 1000);
	/* Deliberately defensive about terv.gomb: when a mutation makes the plan
	   pick the wrong button, every assertion below should get its say rather
	   than the first one throwing and hiding the rest. */
	var gomb = terv.gomb || { classList: { contains: function () { return false; } },
	                          getAttribute: function () { return ''; } };
	eq(terv.tipus, 'most', 'at 2:58 remaining the free finish is offered');
	ok(gomb.classList.contains('btn-instant-free'), 'and the button handed back is the free one');
	ok(gomb.getAttribute('onclick').indexOf('BuildInstantFree') !== -1,
	   'whose onclick calls the free action');

	/* Between ten and three minutes out it is the PAID button that is live and
	   visible. That is the whole window in which a careless selector quietly
	   spends premium points, so it gets its own assertions: nothing is
	   offered, no button is handed back, and the wait runs on to the free
	   window rather than stopping at the paid one. */
	var kozben = api().befejezesTerv(sor, (BEF_TOL - 100) * 1000);
	eq(kozben.tipus, 'kesobb', 'while only the paid button is live, nothing is offered');
	eq(kozben.gomb, undefined, 'and no button is handed back at all');
	eq(kozben.mikorMs, (BEF_TOL + 2) * 1000, 'the wait runs to the free window, not the paid one');

	/* Both halves of the guard, one at a time. The paid button passes neither
	   test; a button carrying the free class but the paid action passes the
	   first and must still be refused. */
	var api0 = api();
	eq(api0.befejezesGombErvenyes(sor.querySelector('.btn-instant')), false,
	   'the paid button is refused');
	eq(api0.befejezesGombErvenyes(sor.querySelector('.btn-instant-free')), true,
	   'the free button is accepted');
	var hamis = buildQueueEl([elonyRow({ freeOnclick: "return BuildingMain.change_order(209230, 'BuildInstant', 10)" })]);
	eq(api0.befejezesGombErvenyes(hamis.querySelector('.btn-instant-free')), false,
	   'the free class alone is not enough -- the onclick must say so too');
	eq(api0.befejezesGombErvenyes(null), false, 'and nothing at all is refused rather than thrown at');

	/* Each half of the guard has to be able to refuse on its own, or it is
	   decoration. The case above proves the onclick half; this one proves the
	   class half, by handing it the paid button with an onclick that would
	   otherwise pass. Contrived on purpose: the point is that neither piece of
	   evidence is trusted alone. */
	var osszekevert = buildQueueEl([elonyRow()]).querySelector('.btn-instant');
	osszekevert.setAttribute('onclick', "return BuildingMain.change_order(209230, 'BuildInstantFree', 0)");
	eq(api0.befejezesGombErvenyes(osszekevert), false,
	   'the paid button is refused even when its onclick would have passed');

	/* A button that cannot be proved free is not clicked and not ignored:
	   it is reported, because it means the game changed under us. */
	var h1 = [];
	eq(api(h1).befejezesTerv(hamis, (BEF_TOL + 2) * 1000).tipus, 'gyanus',
	   'a free-classed button with a paid action is treated as suspect');
	eq(h1, [], 'planning alone says nothing');

	/* --- the click itself -------------------------------------------------- */

	var kattintva = 0;
	var jo = sor.querySelector('.btn-instant-free');
	jo.click = function () { kattintva++; };
	var h2 = [];
	eq(api(h2).befejezesKattint(jo, 'Falu'), true, 'the free button is clicked');
	eq(kattintva, 1, 'exactly once');
	eq(h2, [], 'without complaint');

	/* The re-check immediately before clicking is what protects against the
	   game rewriting the row between planning and acting. */
	var rossz = hamis.querySelector('.btn-instant-free');
	var rosszKattintva = 0;
	rossz.click = function () { rosszKattintva++; };
	var h3 = [];
	eq(api(h3).befejezesKattint(rossz, 'Falu'), false, 'a button that cannot be proved free is not clicked');
	eq(rosszKattintva, 0, 'it is never clicked at all');
	eq(h3.length, 1, 'and it is reported');
	ok(String(h3[0]).indexOf('Prémium pont nem fogyott') !== -1, 'saying plainly that nothing was spent');

	var fizetos = sor.querySelector('.btn-instant');
	var fizetosKattintva = 0;
	fizetos.click = function () { fizetosKattintva++; };
	eq(api([]).befejezesKattint(fizetos, 'Falu'), false, 'the paid button is refused outright');
	eq(fizetosKattintva, 0, 'and stays unclicked');

	/* --- the timing -------------------------------------------------------- */

	/* Two seconds early is still early. This is the boundary the whole
	   feature is specified on: fire at 2:58 remaining, not at 3:00. */
	eq(api().befejezesTerv(sor, (BEF_TOL + 1) * 1000).tipus, 'kesobb',
	   'one second before the hold-off it is still too early');
	eq(api().befejezesTerv(sor, (BEF_TOL + 1) * 1000).mikorMs, (BEF_TOL + 2) * 1000,
	   'and it says to come back at exactly 2:58 remaining');
	eq(api().befejezesTerv(sor, BEF_TOL * 1000).tipus, 'kesobb',
	   'the moment the window opens is not yet the moment to click');

	/* The spec restated as arithmetic: 2:58 remaining is the free button's
	   own available-from plus two, which is also the end time minus 178. */
	eq(api().befejezesTerv(sor, (BEF_TOL - 3600) * 1000).mikorMs, (BEF_IG - 178) * 1000,
	   'an hour out, the return time is the end time less 178 seconds');

	/* Past the far edge the build has finished by itself. */
	eq(api().befejezesTerv(sor, BEF_IG * 1000).tipus, 'nincs',
	   'once the window has closed there is nothing to click');

	/* --- when the buttons are not there ------------------------------------ */

	/* If the game only renders the free button near the end, the live order's
	   own clock still says when the window opens. */
	var oraCsak = buildQueueEl([elonyRow({ noFree: true })]);
	eq(oraCsak.querySelectorAll('.btn-instant-free').length, 0, 'the fixture really has no free button');
	var t2 = api().befejezesTerv(oraCsak, (BEF_IG - 3600) * 1000);
	eq(t2.tipus, 'kesobb', 'the live timer alone is enough to schedule a return');
	eq(t2.mikorMs, (BEF_IG - 178) * 1000, 'at the same moment the button would have given');

	/* A queue of orders that are merely waiting has no live clock and no
	   instant buttons -- only the -50% one -- so there is nothing to finish. */
	var varakozo = buildQueueEl([orderRow('farm', '1:05:03')]);
	eq(api().befejezesTerv(varakozo, Date.now()).tipus, 'nincs',
	   'a queue with nothing actually building offers nothing');
	eq(api().befejezesTerv(null, Date.now()).tipus, 'nincs',
	   'and a village with no queue at all is not an error');

	/* --- the name, for the log --------------------------------------------- */

	eq(api().befejezesEpulet(sor.querySelector('.btn-instant-free')), 'Vasbánya 20. szint',
	   'the finished building is named the way the game names it');
	eq(api().befejezesEpulet(null), 'egy épület', 'and an unknown one still reads as a sentence');
});


/* --------------------------------------------- auto befejezo, az utemezes
   The module drives itself off one number per village: when to look at it
   next. Getting that wrong is not cosmetic -- too eager and it reloads the
   same page in a tight loop, too lazy and it sleeps through the three-minute
   window the whole feature exists for. */
function befWorld() {
	var w = {
		KTID: { '500|500': 11, '501|501': 22, '502|502': 33 },
		ID_TO_INFO: { 11: { name: 'Egy' }, 22: { name: 'Ketto' }, 33: { name: 'Harom' } },
		SZEM4_BEF: {},
		BEF_VILLINFO: {},
		BEF_LEPES: 0,
		BEF_FALU: 0,
		BEF_HIBA: 0,
		BEF_REF: null,
		AZON: 'X',
		clock: 1788770000000,
		opened: [], logged: [], allapotok: {},
		gameUrl: function (o) { return 'URL:' + o.village; },
		naplo: function (k, s) { w.logged.push(k + ': ' + s); },
		debug: function (k, s) { w.logged.push('DEBUG ' + k + ': ' + s); }
	};
	w.Date = function (ms) { return { toLocaleTimeString: function () { return 'T' + ms; } }; };
	w.Date.now = function () { return w.clock; };
	w.windowOpener = function (id, url, nev) { w.opened.push(url); return { document: w.doc }; };
	w.document = { getElementById: function () { return null; } };
	return w;
}

function befApi(w) {
	return sandbox(w, [
		sliceFrom(SZEM4_SRC, 'var BEF_RATARTAS_MP', 'befejezesKattint'),
		sliceFn(SZEM4_SRC, 'szem4_BEF_allapot'),
		sliceFn(SZEM4_SRC, 'szem4_BEF_setVill'),
		sliceFn(SZEM4_SRC, 'szem4_BEF_keres'),
		sliceFn(SZEM4_SRC, 'szem4_BEF_ellenoriz'),
		'var BEF_UJRA_MS = ' + befConst('BEF_UJRA_MS') + ';',
		'var BEF_URES_MS = ' + befConst('BEF_URES_MS') + ';',
		'var BEF_GYANUS_MS = ' + befConst('BEF_GYANUS_MS') + ';'
	]);
}
/* The three waits are read out of the source rather than copied, so changing
   one in the module changes it here too. */
function befConst(nev) {
	var m = new RegExp('var ' + nev + ' = ([0-9]+)').exec(SZEM4_SRC);
	if (!m) throw new Error('no such constant: ' + nev);
	return m[1];
}

suite('auto befejezo -- melyik falut nezzuk meg', function () {
	var w = befWorld(), api = befApi(w);

	/* Nothing is ticked, so there is nothing to do and no page to fetch. */
	eq(api.szem4_BEF_keres(), 60000, 'with no village chosen it waits a minute');
	eq(w.opened, [], 'and opens nothing');

	w.SZEM4_BEF = { 22: true };
	eq(api.szem4_BEF_keres(), 0, 'a chosen village is picked up straight away');
	eq(w.opened, ['URL:22'], 'and only that one is opened');
	eq(w.BEF_FALU, 22, 'the module remembers which village it is looking at');
	eq(w.BEF_LEPES, 1, 'and moves on to waiting for the page');

	/* A village with a future appointment is left alone, and the sleep runs
	   to that appointment rather than to a fixed poll. */
	w = befWorld(); api = befApi(w);
	w.SZEM4_BEF = { 22: true };
	w.BEF_VILLINFO = { 22: { ujraMs: w.clock + 20000 } };
	eq(api.szem4_BEF_keres(), 20000, 'it sleeps exactly until the village is due');
	eq(w.opened, [], 'and does not fetch the page early');

	/* Two bounds on that sleep: never longer than a minute, so a village
	   ticked in the meantime is not left waiting, and never shorter than a
	   second, so a due-any-moment village cannot spin the loop. */
	w.BEF_VILLINFO = { 22: { ujraMs: w.clock + 3600000 } };
	eq(api.szem4_BEF_keres(), 60000, 'an appointment an hour out still wakes it within the minute');
	w.BEF_VILLINFO = { 22: { ujraMs: w.clock + 5 } };
	eq(api.szem4_BEF_keres(), 1000, 'and one five milliseconds out does not spin the loop');

	/* With several villages waiting it is the soonest that sets the alarm. */
	w.SZEM4_BEF = { 11: true, 22: true, 33: true };
	w.BEF_VILLINFO = { 11: { ujraMs: w.clock + 50000 }, 22: { ujraMs: w.clock + 9000 },
	                   33: { ujraMs: w.clock + 30000 } };
	eq(api.szem4_BEF_keres(), 9000, 'the soonest village sets the alarm');

	/* An unticked village is skipped even when it has an appointment left
	   over from before it was switched off. */
	w.SZEM4_BEF = { 33: true };
	w.BEF_VILLINFO = { 11: { ujraMs: 0 }, 33: { ujraMs: w.clock + 30000 } };
	eq(api.szem4_BEF_keres(), 30000, 'a village that is no longer ticked is not visited');
	eq(w.opened, [], 'even though its time had passed');
});

suite('auto befejezo -- mi tortenik egy falunal', function () {
	function nezes(w, sor) {
		w.BEF_FALU = 22;
		w.BEF_REF = { document: { getElementById: function (id) { return id === 'buildqueue' ? sor : null; } } };
		befApi(w).szem4_BEF_ellenoriz();
		return w.BEF_VILLINFO[22];
	}

	/* Far from the window: the return time is the plan's, to the millisecond,
	   not a rounded-off poll. */
	var w = befWorld();
	var tavol = nezes(w, buildQueueEl([elonyRow()]));
	eq(tavol.ujraMs, (BEF_TOL + 2) * 1000, 'a village mid-build is booked for exactly 2:58 remaining');
	eq(w.logged, [], 'and nothing is written to the log for it');

	/* In the window: the button is clicked, the finish is reported by name,
	   and the village is booked back shortly to catch the next order. */
	w = befWorld();
	var sor = buildQueueEl([elonyRow()]);
	var kattintva = 0;
	sor.querySelector('.btn-instant-free').click = function () { kattintva++; };
	w.clock = (BEF_TOL + 2) * 1000;
	var kesz = nezes(w, sor);
	eq(kattintva, 1, 'the free finish is taken');
	eq(w.logged.length, 1, 'and reported once');
	ok(w.logged[0].indexOf('Vasbánya') !== -1, 'naming the building that was finished');
	eq(kesz.ujraMs, w.clock + Number(befConst('BEF_UJRA_MS')),
	   'and the village is looked at again soon, for the next order in the queue');

	/* A button that cannot be proved free: nothing is clicked, it is said out
	   loud, and the village is left alone for a good while rather than
	   retried every few seconds. */
	w = befWorld();
	var hamis = buildQueueEl([elonyRow({ freeOnclick: "return BuildingMain.change_order(1, 'BuildInstant', 10)" })]);
	var rosszKattintva = 0;
	hamis.querySelector('.btn-instant-free').click = function () { rosszKattintva++; };
	w.clock = (BEF_TOL + 2) * 1000;
	var gyanus = nezes(w, hamis);
	eq(rosszKattintva, 0, 'a suspect button is never clicked');
	eq(w.logged.length, 1, 'and it is reported');
	ok(w.logged[0].indexOf('prémium pont nem fogyott') !== -1, 'saying that nothing was spent');
	eq(gyanus.ujraMs, w.clock + Number(befConst('BEF_GYANUS_MS')),
	   'and the village is left alone for half an hour rather than retried');

	/* Nothing building at all is not a fault, just a slower poll. */
	w = befWorld();
	var ures = nezes(w, buildQueueEl([orderRow('farm', '1:05:03')]));
	eq(ures.ujraMs, w.clock + Number(befConst('BEF_URES_MS')),
	   'a village with nothing building is looked at again in five minutes');
	eq(w.logged, [], 'quietly');

	/* The one that matters most. If reading the page throws, the village must
	   STILL come away with a wait on it -- otherwise it is due again on the
	   very next tick, and a village whose page is broken would be reloaded
	   several times a second for as long as SZEM runs. */
	w = befWorld();
	w.BEF_FALU = 22;
	w.BEF_REF = { get document() { throw new Error('az ablak elszállt'); } };
	befApi(w).szem4_BEF_ellenoriz();
	ok(w.BEF_VILLINFO[22] && w.BEF_VILLINFO[22].ujraMs === w.clock + Number(befConst('BEF_URES_MS')),
	   'a village whose page could not be read is still given a wait');
	eq(w.BEF_HIBA, 1, 'the failure is counted');
	eq(w.logged.length, 1, 'and reported');
});

suite('auto befejezo -- a falu ki- es bekapcsolasa', function () {
	var w = befWorld();
	var doboz = { checked: false, type: 'checkbox' };
	var cella = { querySelector: function () { return doboz; } };
	var api = befApi(w);

	/* Switching a village on clears whatever appointment it had, so it is
	   looked at at once instead of honouring a time set before it was off. */
	w.BEF_VILLINFO = { 22: { ujraMs: w.clock + 3600000 } };
	api.szem4_BEF_setVill(22, cella);
	eq(w.SZEM4_BEF[22], true, 'ticking a village records it');
	eq(doboz.checked, true, 'and the box shows it');
	eq(w.BEF_VILLINFO[22], undefined, 'its old appointment is forgotten');

	api.szem4_BEF_setVill(22, cella);
	eq(w.SZEM4_BEF[22], undefined, 'unticking removes it rather than storing a false');
	eq(doboz.checked, false, 'and the box shows that too');
});

/* ------------------------------------------------------------------------ */
/* The Toborzó's templates. A village is given a role, and the role states the
   SHAPE its army grows into rather than a quantity to reach -- so the same
   template is meaningful on a village at 5% built and one at 90%.

   Nothing recruits yet; this suite pins the model and the fact that it
   survives a reload, which is all the first commit claims. */
suite('The army templates a village grows into', function () {
	var api = sandbox({}, [
		sliceFrom(SZEM4_SRC, 'var TOBORZO_SABLON_ALAP', 'mergeToborzoState')
	]);
	var alap = api.defaultToborzoState();
	var sablonok = alap.sablonok;

	eq(Object.keys(sablonok).sort(), ['tamado', 'vedo', 'vegyes'],
	   'there is a template for attacking, defending, and doing both at once');
	eq(alap.falvak, {},
	   'and no village is recruited for until it is given one');

	/* --- the invariant that protects the farm engine --- */
	var lovasok = [];
	for (var nev in sablonok) {
		if (sablonok[nev].gyujtoEgysegek.indexOf('light') !== -1) lovasok.push(nev);
	}
	eq(lovasok, [],
	   'no template ever hands the gatherer light cavalry: that is the farm engine army');

	/* --- his own two rules about the roles --- */
	eq(sablonok.tamado.gyujtoEgysegek, ['axe'],
	   'an attacker scavenges with axes only, its cavalry being out farming');
	ok(sablonok.vedo.osszetetel.light === undefined,
	   'a defender owns no cavalry at all, which is why it never farms');
	ok(sablonok.vedo.gyujtoEgysegek.length > 1,
	   'but its whole army can scavenge, so it is the better gatherer of the two');
	ok(sablonok.vegyes.osszetetel.light > 0 && sablonok.vegyes.osszetetel.axe > 0,
	   'the mixed role farms and gathers at once, which is what a first village must do');

	/* --- proportions, not quantities --- */
	var rosszSzam = [];
	for (var n2 in sablonok) {
		var ossz = sablonok[n2].osszetetel;
		for (var egyseg in ossz) {
			if (!(ossz[egyseg] > 0) || !isFinite(ossz[egyseg])) rosszSzam.push(n2 + '.' + egyseg);
		}
		if (!(sablonok[n2].nepessegAranyMax > 0) || sablonok[n2].nepessegAranyMax >= 1) {
			rosszSzam.push(n2 + '.nepessegAranyMax');
		}
	}
	eq(rosszSzam, [],
	   'every share is a real positive number, and every army stops short of the whole farm');

	/* Buildings cost population too. A template allowed to fill the farm would
	   leave no room to raise anything ever again. */
	ok(sablonok.tamado.nepessegAranyMax < 1,
	   'the army is capped below the farm so buildings can still be raised');

	/* --- the defaults must not be editable by accident --- */
	/* Captured as a plain number first: comparing the edited copy against
	   sablonok.tamado would compare the shared object with itself, and pass no
	   matter what the deep copy does. */
	var axeAlap = sablonok.tamado.osszetetel.axe;
	var elso = api.defaultToborzoState();
	elso.sablonok.tamado.osszetetel.axe = 999;
	elso.sablonok.tamado.gyujtoEgysegek.push('light');
	var masodik = api.defaultToborzoState();
	eq(masodik.sablonok.tamado.osszetetel.axe, axeAlap,
	   'editing a template never writes back into the defaults');
	eq(masodik.sablonok.tamado.gyujtoEgysegek, ['axe'],
	   'nor into the list of units the gatherer may spend, or a reset would hand back the edit');

	/* --- loading: repair, never replace --- */
	/* Everywhere else in the file a stored object replaces the default entire,
	   so a field added later arrives undefined on exactly the installs that
	   have been used. That is how the Gyűjtő's cap box shipped blank. */
	var regi = api.mergeToborzoState({
		falvak: { 4242: 'vedo' },
		sablonok: { tamado: { osszetetel: { axe: 90, light: 10 } } }
	});
	eq(regi.falvak, { 4242: 'vedo' }, 'a stored village keeps the template it was given');
	eq(regi.sablonok.tamado.osszetetel, { axe: 90, light: 10 },
	   'an edited composition is kept exactly as it was edited');
	eq(regi.sablonok.tamado.gyujtoEgysegek, ['axe'],
	   'and a field the stored copy never had is filled in rather than left undefined');
	eq(regi.sablonok.tamado.nepessegAranyMax, sablonok.tamado.nepessegAranyMax,
	   'including the population ceiling, which the recruiter would otherwise read as zero');
	eq(Object.keys(regi.sablonok).sort(), ['tamado', 'vedo', 'vegyes'],
	   'the templates that were not stored are still there');

	var sajat = api.mergeToborzoState({ sablonok: { sajat: { nev: 'Sajat', osszetetel: { spear: 1 } } } });
	eq(sajat.sablonok.sajat.osszetetel, { spear: 1 },
	   'a template of his own making is kept, not dropped for being unknown');

	/* --- total: this reads whatever localStorage happens to hold --- */
	/* Read back inside the try as well as called inside it: a mutation that
	   makes one of these come back broken would otherwise throw on the line
	   below and abort the whole suite, hiding which assertion actually died. */
	var szemetOk;
	try {
		szemetOk = [null, 'nonsense', { sablonok: { tamado: null } }, { sablonok: 5 }]
			.every(function (rossz) {
				return api.mergeToborzoState(rossz).sablonok.tamado.osszetetel.axe === axeAlap;
			});
	} catch (e) { szemetOk = 'threw: ' + e.message; }
	ok(szemetOk === true,
	   'nothing stored, or nonsense stored, comes back as the defaults rather than a crash');

	/* --- it has to survive a reload, or none of the above matters --- */
	var forras = codeOnly(SZEM4_SRC);
	ok(forras.indexOf("case \"toborzo\": storeGuarded(AZON + '_toborzo'") !== -1,
	   'the templates are written to storage');
	ok(forras.indexOf('SZEM4_TOBORZO = mergeToborzoState(dataObj)') !== -1,
	   'and read back through the repair rather than replaced wholesale');
	ok(forras.indexOf('name="toborzo" checked') !== -1,
	   'the Adatmentő lists it, or the once-a-minute autosave never saves it');
	ok(forras.indexOf('SZEM4_TOBORZO = defaultToborzoState()') !== -1,
	   'and a reset puts the shipped templates back');
});

/* ------------------------------------------------------------------------ */
/* Auto befejező is on every other persistence path (saveNow, loadNow, restart,
   the #adat_opts row) but was missing from the two cloud sync functions, so a
   fresh machine restoring from the cloud lost which villages had it enabled. */
suite('saveLocalDataToCloud / loadCloudDataIntoLocal carry bef', function () {
	var mento = codeOnly(sliceFn(SZEM4_SRC, 'saveLocalDataToCloud'));
	ok(mento.indexOf('bef:') !== -1 && mento.indexOf('AZON+"_bef"') !== -1,
	   'saving to the cloud reads the bef state out of localStorage, same as the other modules');

	var betolto = codeOnly(sliceFn(SZEM4_SRC, 'loadCloudDataIntoLocal'));
	ok(betolto.indexOf('if (cloudData.bef)') !== -1,
	   'restoring from the cloud guards bef the same way toborzo is guarded');
	ok(betolto.indexOf('localStorage.setItem(AZON+"_bef", cloudData.bef)') !== -1,
	   'and, when present, writes it back under the same key szem4_ADAT_loadNow reads');
});

/* ------------------------------------------------------------------------ */
/* The gatherer books its next visit for when a squad gets home. Under 'max' it
   waits for the SLOWEST option, so the quick options' troops stand idle in
   between -- on a real saved page the two running squads were 1h33m apart.

   The second half matters as much as the first: rebuildDOM_gyujto() runs only
   from the load and reset paths, so on a fresh install nothing ever writes the
   stored strategy into the <select>. The box shows whichever option the markup
   lists first, and if that disagrees with defaultGyujtoState() the interface
   silently misreports which strategy the engine is running. */
suite('Which gathering the gatherer waits for', function () {
	var api = sandbox({}, [
		sliceFrom(SZEM4_SRC, 'var GYUJTO_MAX_FUTAS_MP', 'scavengeTerv'),
		sliceFn(SZEM4_SRC, 'defaultGyujtoState')
	]);
	var alap = api.defaultGyujtoState().settings.strategy;

	eq(alap, 'min', 'a fresh install comes back for the first squad home, so no troops idle');

	/* The <select> as a browser reads it before any of SZEM's code runs. */
	var sel = SZEM4_SRC.slice(SZEM4_SRC.indexOf('<select name="strategy"'));
	sel = sel.slice(0, sel.indexOf('</select>'));
	var opts = [];
	sel.replace(/<option value="([^"]*)"([^>]*)>/g, function (_, val, rest) {
		opts.push({ value: val, selected: rest.indexOf('selected') !== -1 });
		return '';
	});

	eq(opts.map(function (o) { return o.value; }), ['min', 'max', 'egyutt'],
	   'the three strategies are still the ones the engine branches on');

	var shown = opts.filter(function (o) { return o.selected; })[0] || opts[0];
	eq(shown.value, alap, 'the box shows the strategy the engine actually starts with');

	/* Waiting for every option is a legitimate choice -- it lets the game split
	   troops across all four at once -- but its cost is invisible in a label that
	   states only the mechanism, and the cost is the whole reason the default
	   moved off it. So the label has to say it out loud. */
	var lassuCimke = sel.slice(sel.indexOf('<option value="max"'));
	lassuCimke = lassuCimke.slice(lassuCimke.indexOf('>') + 1, lassuCimke.indexOf('</option>'));
	ok(lassuCimke.indexOf('csapatai') !== -1,
	   'the waiting strategy says outright that troops will be left waiting');

	/* The box only ever received a value; it never sent one anywhere, so the
	   engine went on reading whatever was in storage while the interface showed
	   the choice as taken. Both halves are pinned: the handler stores the pick,
	   and the markup actually calls the handler. */
	var vilag = { SZEM4_GYUJTO: { settings: { strategy: 'min' } } };
	var beallit = sandbox(vilag, [sliceFn(SZEM4_SRC, 'gyujto_setStrategia')]);

	beallit.gyujto_setStrategia({ value: 'max' });
	eq(vilag.SZEM4_GYUJTO.settings.strategy, 'max',
	   'choosing a strategy is what the engine then runs');
	beallit.gyujto_setStrategia({ value: 'min' });
	eq(vilag.SZEM4_GYUJTO.settings.strategy, 'min', 'and choosing back again works too');

	/* Total on purpose: this runs from an inline handler, and a throw there is
	   swallowed by the browser, so a bad call must leave the setting alone
	   rather than store undefined and strand the engine on no strategy at all. */
	var ures = 'rendben';
	try {
		beallit.gyujto_setStrategia(null);
		beallit.gyujto_setStrategia({ value: '' });
	} catch (e) { ures = 'threw: ' + e.message; }
	ok(ures === 'rendben' && vilag.SZEM4_GYUJTO.settings.strategy === 'min',
	   'and a call with nothing chosen leaves the strategy as it was');

	ok(sel.indexOf('gyujto_setStrategia(this)') !== -1,
	   'the box is wired to the handler, or picking a strategy does nothing again');

	/* The new strategy is offered but not made the default: it has not been
	   watched in a real game yet, and the running default has. */
	var egyuttCimke = sel.slice(sel.indexOf('<option value="egyutt"'));
	egyuttCimke = egyuttCimke.slice(egyuttCimke.indexOf('>') + 1, egyuttCimke.indexOf('</option>'));
	ok(egyuttCimke.indexOf('egyszerre') !== -1 && egyuttCimke.indexOf('azonnal') !== -1,
	   'and its label says what it does: sends at once, and lands together');

	/* --- the cap, which is also the garrison left at home --- */
	var caps = { SZEM4_GYUJTO: { settings: { strategy: 'min', maxora: 8 } } };
	var capApi = sandbox(caps, [sliceFn(SZEM4_SRC, 'gyujto_setMaxOra')]);
	eq(api.defaultGyujtoState().settings.maxora, 8,
	   'a fresh install caps a gathering run at eight hours');

	var doboz = { value: '3' };
	capApi.gyujto_setMaxOra(doboz);
	eq(caps.SZEM4_GYUJTO.settings.maxora, 3, 'a new cap is what the gatherer then plans against');

	/* A blank box must not read as "no cap" while the engine runs on the old
	   one, so a refused value is put back on screen. */
	var rossz = { value: '' };
	capApi.gyujto_setMaxOra(rossz);
	eq(caps.SZEM4_GYUJTO.settings.maxora, 3, 'a blank cap is refused rather than stored');
	eq(rossz.value, 3, 'and the box is put back to the cap actually in force');
	capApi.gyujto_setMaxOra({ value: '0' });
	eq(caps.SZEM4_GYUJTO.settings.maxora, 3, 'and so is a cap of nothing at all');

	ok(codeOnly(SZEM4_SRC).indexOf('name="maxora"') !== -1
	   && codeOnly(SZEM4_SRC).indexOf('gyujto_setMaxOra(this)') !== -1,
	   'the cap has a box in the panel and it is wired, or it could only be changed by editing the script');

	/* An install that has run before carries a stored settings object, and the
	   load merges one level deep, so it replaces the default entire -- a
	   setting added later arrives undefined on exactly the installs that have
	   been used. The box would then sit blank while the engine capped at eight.
	   Same trap as the farm's STAT block. */
	var regi = {
		SZEM4_GYUJTO: { 4242: true, settings: { strategy: 'max' } },
		GYUJTO_MAX_FUTAS_MP: 8 * 3600,
		document: { querySelector: function () {
			return { strategy: {}, maxora: {}, f4242: {} };
		} }
	};
	sandbox(regi, [sliceFn(SZEM4_SRC, 'rebuildDOM_gyujto')]).rebuildDOM_gyujto();
	eq(regi.SZEM4_GYUJTO.settings.maxora, 8,
	   'an install from before the cap existed is repaired on load, not left blank');
});

/* ------------------------------------------------------------------------ */
/* The gatherer used to work out its next visit by reading the painted
   countdown text and adding it to getServerTime() -- a display clock, shifted
   by TIME_ZONE and rounded to 15 minutes, so an instant built from it can be a
   quarter of an hour out. The game states each squad's homecoming as a plain
   unix timestamp, so that is what gets read now.

   sliceFrom() takes everything from the constants down to the END of the named
   function, so scavengeNextVisitMs has to stay the last of the three in the
   source or the others drop out of the sandbox. */
suite('When the gatherer books its next visit', function () {
	var api = sandbox({}, [sliceFrom(SZEM4_SRC, 'var GYUJTO_URES_MS', 'scavengeNextVisitMs')]);

	function doc(texts, kivul) {
		return { querySelectorAll: function (q) {
			var sajat = q === '#scavenge_screen .return-countdown';
			return (sajat ? texts : (kivul || [])).map(function (s) { return { textContent: s }; });
		}};
	}

	/* --- reading a countdown, whichever fields the game bothered to paint --- */
	eq(api.countdownSeconds('1:30:47'), 5447, 'hours, minutes and seconds');
	eq(api.countdownSeconds('30:47'), 1847, 'the hour is dropped once there is none left');
	eq(api.countdownSeconds('47'), 47, 'and the minute too, in the last stretch');
	/* Identity, not eq(): the harness compares by JSON and JSON.stringify(NaN) is
	   "null", so eq(..., null) passes for NaN too -- which is precisely the
	   distinction these three exist to defend. Caught by mutation. */
	ok(api.countdownSeconds('') === null, 'a countdown the game has not painted yet is not a time');
	ok(api.countdownSeconds('hamarosan') === null, 'nor is a word');
	ok(api.countdownSeconds('1:2:3:4') === null, 'nor four fields');

	/* --- his own saved page: options 1 idle, 2 and 3 out, 4 locked --- */
	var most = 1788786000000, korai = 1788787220000, kesoi = 1788792807000;
	var jatek = { ScavengeScreen: { village: { options: {
		'1': { is_locked: false, scavenging_squad: null },
		'2': { is_locked: false, scavenging_squad: { return_time: 1788787220 } },
		'3': { is_locked: false, scavenging_squad: { return_time: 1788792807 } },
		'4': { is_locked: true, scavenging_squad: null }
	} } } };

	eq(api.scavengeReturnsMs(jatek, doc(['0:00:09']), most), [korai, kesoi],
	   'the two running squads are read from the game, not from the painted text');

	eq(api.scavengeReturnsMs({}, doc(['0:10:00']), most), [most + 600000],
	   'with no game object it falls back to the countdown, as a duration from now');

	eq(api.scavengeReturnsMs({}, doc(['', '0:10:00']), most), [most + 600000],
	   'an unpainted countdown is skipped rather than poisoning the whole list');

	eq(api.scavengeReturnsMs({}, doc([], ['5:00:00']), most), [],
	   'a countdown outside the scavenge screen belongs to something else, not to us');

	/* Caught here on purpose: if the fallback stops catching, this has to read as
	   one named failure rather than an exception that abandons the rest of the
	   suite and hides every assertion below it. */
	var tuno = { get ScavengeScreen() { throw new Error('window is being replaced'); } };
	var tunoEredmeny;
	try { tunoEredmeny = api.scavengeReturnsMs(tuno, doc(['0:05:00']), most); }
	catch (e) { tunoEredmeny = 'threw: ' + e.message; }
	eq(tunoEredmeny, [most + 300000],
	   'a window mid-navigation falls back instead of throwing');

	/* --- and which of them the next visit is booked for --- */
	eq(api.scavengeNextVisitMs([korai, kesoi], 'min', most), korai + 60000,
	   'min comes back for the first squad home, so its troops go straight out again');
	eq(api.scavengeNextVisitMs([korai, kesoi], 'max', most), kesoi + 60000,
	   'max waits for the last -- the 1h33m of idle troops he reported');
	eq(api.scavengeNextVisitMs([], 'min', most), most + 1200000,
	   'nothing gathering here: twenty minutes before looking again');
	eq(api.scavengeNextVisitMs([most - 500000], 'min', most), most + 10000,
	   'an overdue squad cannot book a visit in the past and reopen the page every tick');
});

/* ------------------------------------------------------------------------ */
/* Working out how long a run will take BEFORE sending it -- the thing the
   gatherer could never do, and the reason squads drift apart.

   The numbers below are not invented for the test. They are the constants his
   own game handed back from ScavengeScreen.village.options[n].base, and the
   4435 / 7203 / 2218 trio is a real squad of his: 48 spear + 49 sword + 250
   axe, which the game ran for two hours and sent home with 2218 resources. So
   these assertions hold the code against the game rather than against my
   algebra. */
suite('When the gatherer works out how long a run would take', function () {
	var api = sandbox({}, [
		sliceFn(SZEM4_SRC, 'scavengeBaseOk'),
		sliceFn(SZEM4_SRC, 'scavengeDurationSec'),
		sliceFn(SZEM4_SRC, 'scavengeMinDurationSec'),
		sliceFn(SZEM4_SRC, 'scavengeCapacityFor'),
		sliceFn(SZEM4_SRC, 'scavengeHaul')
	]);

	function base(lootFactor) {
		return { loot_factor: lootFactor, duration_exponent: 0.45,
		         duration_initial_seconds: 1800, duration_factor: 0.7237692407143577 };
	}
	var gyenge = base(0.1), kozepes = base(0.25), eros = base(0.5);

	/* --- against his real squad --- */
	eq(api.scavengeDurationSec(4435, eros), 7203,
	   'his own squad of 4435 carry comes out as the two-hour run the game gave it');
	eq(api.scavengeHaul(4435, eros), 2218,
	   'and as the 2218 resources that squad actually came home with');
	eq(api.scavengeCapacityFor(7203, eros), 4435,
	   'and asking the other way round for that run length asks for that same squad back');

	/* --- the floor, which is what makes landing together sometimes impossible --- */
	eq(api.scavengeMinDurationSec(eros), 1303,
	   'sending nobody at all still takes 21.7 minutes: no run can be shorter');
	eq(api.scavengeDurationSec(0, eros), api.scavengeMinDurationSec(eros),
	   'which is simply what an empty squad costs');
	/* Identity, not eq(): below the floor the bracket goes negative and the
	   fractional power is NaN, and the harness compares by JSON, where
	   JSON.stringify(NaN) is "null" -- so eq(..., null) would pass on the very
	   value this exists to refuse. Same trap as countdownSeconds. */
	ok(api.scavengeCapacityFor(1302, eros) === null,
	   'a window shorter than the floor has no squad size that fits it');
	eq(api.scavengeCapacityFor(1303, eros), 0,
	   'and exactly at the floor the answer is an empty squad, not a refusal');
	/* The other end, and it is the only thing holding the last guard in that
	   function: a window this long overflows the power to Infinity, which is
	   finite-looking enough to be typed into a troop box. The floor check above
	   cannot catch this one -- it only refuses windows that are too SHORT. */
	ok(api.scavengeCapacityFor(1e308, eros) === null,
	   'and a window too long to compute is refused rather than answered with Infinity');

	/* --- the two directions agree, on more than the one live sample --- */
	eq(api.scavengeDurationSec(api.scavengeCapacityFor(3600, eros), eros), 3600,
	   'an hour asked for is an hour sent');
	eq(api.scavengeDurationSec(api.scavengeCapacityFor(5400, kozepes), kozepes), 5400,
	   'and on a different option too, so neither direction is fitted to one of them');

	/* --- the option matters, and in the direction that drives the strategy --- */
	eq(api.scavengeCapacityFor(3600, eros), 1555, 'an hour on the 50% option');
	eq(api.scavengeCapacityFor(3600, gyenge), 7774, 'the same hour on the 10% option');
	ok(api.scavengeCapacityFor(3600, gyenge) > api.scavengeCapacityFor(3600, eros),
	   'the weak option costs far more troops to keep busy for the same time');

	/* The constants are the option's own, never written down in SZEM: a world
	   with different scavenging numbers has to come out different, or this is
	   pinned to his server and silently wrong on any other. */
	var maswilag = { loot_factor: 0.5, duration_exponent: 0.45,
	                 duration_initial_seconds: 600, duration_factor: 1 };
	eq(api.scavengeMinDurationSec(maswilag), 600,
	   'the overhead of another world is read from that world, not assumed');

	/* --- total, because the answers get typed into the game's own send form --- */
	/* Caught on purpose: reading a constant off a missing option throws rather
	   than returning anything, and an exception here would abandon the suite and
	   hide every assertion below instead of naming this one. */
	var nincsOpcio;
	try { nincsOpcio = api.scavengeDurationSec(100, null); }
	catch (e) { nincsOpcio = 'threw: ' + e.message; }
	ok(nincsOpcio === null, 'no option, no answer');
	ok(api.scavengeDurationSec(100, {}) === null, 'nor from an option missing its constants');
	ok(api.scavengeDurationSec(100, base(undefined)) === null, 'nor with the loot factor missing');
	ok(api.scavengeDurationSec(-1, eros) === null, 'a negative squad is not a squad');
	ok(api.scavengeDurationSec(NaN, eros) === null, 'and NaN never becomes a run length');
	ok(api.scavengeCapacityFor(NaN, eros) === null, 'nor a squad size');
	ok(api.scavengeCapacityFor(3600, base(0)) === null,
	   'an option that loots nothing would divide by zero rather than say so');
	ok(api.scavengeHaul(-5, eros) === null, 'and no haul is owed to a negative squad');
});

/* ------------------------------------------------------------------------ */
/* Choosing the run length and the squad sizes -- the strategy itself.

   sliceFrom() cuts to the END of the function it is given, so scavengeTerv has
   to stay the last of the planning block in the source or the rest drop out of
   the sandbox. The arithmetic it leans on sits above the block and is cut
   function by function. */
suite('When the gatherer plans a round of scavenging', function () {
	var api = sandbox({}, [
		sliceFn(SZEM4_SRC, 'scavengeBaseOk'),
		sliceFn(SZEM4_SRC, 'scavengeDurationSec'),
		sliceFn(SZEM4_SRC, 'scavengeMinDurationSec'),
		sliceFn(SZEM4_SRC, 'scavengeCapacityFor'),
		sliceFn(SZEM4_SRC, 'scavengeHaul'),
		sliceFrom(SZEM4_SRC, 'var GYUJTO_MAX_FUTAS_MP', 'scavengeTerv')
	]);

	function base(lootFactor) {
		return { loot_factor: lootFactor, duration_exponent: 0.45,
		         duration_initial_seconds: 1800, duration_factor: 0.7237692407143577 };
	}
	/* His three unlocked options, and the fourth he has not bought yet. */
	var opciok = [{ id: 1, base: base(0.1) }, { id: 2, base: base(0.25) }, { id: 3, base: base(0.5) }];
	var negy = opciok.concat([{ id: 4, base: base(0.75) }]);
	var NYOLC_ORA = 8 * 3600;
	function idk(terv) { return terv.tetelek.map(function (t) { return t.id; }); }
	function teherek(terv) { return terv.tetelek.map(function (t) { return t.kapacitas; }); }

	/* --- nothing out there: the run length is ours to choose --- */
	var szabad = api.scavengeTerv(opciok, 4565, null, NYOLC_ORA);
	eq(szabad.mp, 3556,
	   'his own troop pool today comes out as a 59-minute run, not a chosen number');
	eq(idk(szabad), [3, 2],
	   'and it leaves the 10% option out: a weak option starves the good ones of troops');
	eq(teherek(szabad), [1522, 3043], 'the good option gets the smaller squad, being worth more per unit carried');

	/* The point of the whole strategy, asserted as a property rather than by
	   reading the number back: whatever it decided, every squad it sends has to
	   come home at the same moment. */
	var egyszerre = szabad.tetelek.map(function (t) { return api.scavengeDurationSec(t.kapacitas, t.base); });
	eq(egyszerre, [szabad.mp, szabad.mp], 'and every squad it sends lands at the same moment');

	/* --- the cap: free until it binds, and then it is the reserve --- */
	eq(api.scavengeTerv(opciok, 4565, null, 24 * 3600).mp, 3556,
	   'raising the cap changes nothing while it is not binding');
	var nagy = api.scavengeTerv(negy, 400000, null, NYOLC_ORA);
	eq(nagy.mp, 28800, 'a late-game army is held to the cap instead of running half a day');
	var elkuldott = teherek(nagy).reduce(function (a, b) { return a + b; }, 0);
	eq(elkuldott, 212533, 'and only what fits inside the cap goes out');
	ok(elkuldott < 400000 * 0.6,
	   'so nearly half the army stays home -- the cap doubles as the defensive reserve');

	/* --- squads still out: the deadline decides, we only size to it --- */
	eq(api.scavengeTerv(opciok, 4565, 2400, NYOLC_ORA).mp, 2400,
	   'with a squad still out the run is cut to land with it, not chosen freely');
	/* Guarded rather than read straight off: without the floor clamp there is no
	   plan at all here, and reading .mp off null would abandon the suite instead
	   of naming this one assertion. */
	var rovid = api.scavengeTerv(opciok, 4565, 600, NYOLC_ORA);
	ok(rovid && rovid.mp === 1303,
	   'a window under the floor gets the shortest run that exists rather than a refusal');
	eq(api.scavengeTerv(opciok, 4565, 12 * 3600, NYOLC_ORA).mp, 28800,
	   'and one beyond the cap gets the cap, landing early rather than staying out too long');

	/* --- too few troops to fill every option at that deadline --- */
	var szuk = api.scavengeTerv(opciok, 900, 2400, NYOLC_ORA);
	eq(idk(szuk), [3, 2], 'the best option is filled first when there is not enough for all');
	eq(teherek(szuk), [684, 216], 'and what is left over goes out rather than staying home');
	eq(api.scavengeDurationSec(szuk.tetelek[0].kapacitas, szuk.tetelek[0].base), 2400,
	   'the option that got its full share lands exactly on the deadline');
	/* Guarded the same way: filling in the wrong order leaves only one squad
	   here, and indexing into the missing second one would throw. */
	var masodik = szuk.tetelek[1];
	ok(masodik && api.scavengeDurationSec(masodik.kapacitas, masodik.base) < 2400,
	   'while the leftover squad lands early, to be re-aligned on the next visit');

	/* --- total: this feeds a form that sends real troops --- */
	ok(api.scavengeTerv([], 4565, null, NYOLC_ORA) === null, 'no options, no plan');
	ok(api.scavengeTerv(opciok, 0, null, NYOLC_ORA) === null, 'no troops, no plan');
	ok(api.scavengeTerv(null, 4565, null, NYOLC_ORA) === null, 'and no option list at all is not a crash');
	eq(api.scavengeTerv(opciok, 4565, null, 0).mp, 3556,
	   'a nonsense cap falls back to the built-in one instead of sending nothing');
});

/* ------------------------------------------------------------------------ */
/* Turning a carry target into troops that can actually be typed into the send
   form. The carry and population tables are sliced out of the source rather
   than retyped, on the same reasoning as the farm's population suite: a squad
   costed against a made-up table is costed against nothing. */
suite('When the gatherer picks the troops for a squad', function () {
	function tabla(nev) {
		var kezd = SZEM4_SRC.indexOf(nev + ' = {');
		return 'var ' + SZEM4_SRC.slice(kezd, matchBraces(SZEM4_SRC, kezd)) + ';';
	}
	var api = sandbox({}, [
		tabla('TEHER'), tabla('TANYA'),
		sliceFrom(SZEM4_SRC, 'var GYUJTO_EGYSEGEK', 'scavengeEgysegek')
	]);

	var otthon = { spear: 52, sword: 51, axe: 250 };

	/* --- the ordinary case: reach the target, never pass it --- */
	var resz = api.scavengeEgysegek(1522, { spear: 52, sword: 51 });
	eq(resz.egysegek, { spear: 52, sword: 14 },
	   'the units carrying most per head go first, so fewest troops are locked away');
	eq(resz.teher, 1510, 'and the squad stops under the target rather than overshooting it');
	ok(resz.teher <= 1522, 'so it lands at or before the moment it was aimed at, never after');

	eq(api.scavengeEgysegek(4565, otthon).egysegek, otthon,
	   'a target that needs everything he has sends exactly everything he has');
	eq(api.scavengeEgysegek(4565, otthon).nepesseg, 353, 'and reports what that costs in population');

	eq(api.scavengeEgysegek(400, { spear: 10, sword: 10, axe: 10 }).egysegek,
	   { spear: 10, sword: 10 },
	   'the cheapest carriers are left at home once the target is met');

	eq(api.scavengeEgysegek(1010, { spear: 100 }).teher, 1000,
	   'a target that no whole number of units hits exactly is undershot, not rounded up');

	/* --- the minimum the game will accept --- */
	/* Guarded: without the top-up there is no squad here at all, and reading
	   through null would abandon the suite rather than name these two. */
	var parany = api.scavengeEgysegek(0, otthon);
	ok(parany && parany.nepesseg === 10,
	   'a target too small to be legal is topped up to the smallest squad allowed');
	eq(parany ? parany.egysegek : 'nincs csapat', { spear: 10 },
	   'rather than refused, so the troops keep working');
	ok(api.scavengeEgysegek(100, { spear: 3 }) === null,
	   'but with too few troops for even that, there is nothing to send');

	/* --- what it must never touch, and this is the dangerous one --- */
	ok(api.scavengeEgysegek(1000, { light: 100 }) === null,
	   'the farm engine cavalry is never taken, even when it is all that is home');
	ok(api.scavengeEgysegek(1000, { spy: 50 }) === null,
	   'nor are scouts, which would be locked away carrying nothing');
	var vegyes = api.scavengeEgysegek(1000, { spear: 20, light: 100, spy: 50 });
	eq(vegyes.egysegek, { spear: 20 }, 'and a mixed village still only spends the infantry');

	/* --- caller may narrow it further --- */
	eq(api.scavengeEgysegek(100, { spear: 50, axe: 50 }, ['axe']).egysegek, { axe: 10 },
	   'a named list of types is honoured over the default');

	/* --- total: this is the last step before troops actually move --- */
	ok(api.scavengeEgysegek(100, null) === null, 'no troop counts, no squad');
	ok(api.scavengeEgysegek(-1, otthon) === null, 'no squad for a negative target');
	ok(api.scavengeEgysegek(NaN, otthon) === null, 'and none for one that is not a number');
});

/* ------------------------------------------------------------------------ */
/* Reading the screen. The scavenge screen is drawn by the game's own script
   after the page loads and cannot be saved to disk, so everything is taken
   from ScavengeScreen.village -- the data model behind it. The fixture mirrors
   his own console dump: four options, one still locked, one with a squad out,
   and a village holding cavalry and scouts the gatherer must not touch. */
suite('What the gatherer sees on the scavenge screen', function () {
	var api = sandbox(
		{ TEHER: { spear: 25, sword: 15, axe: 10, archer: 10, spy: 0, light: 80 },
		  GYUJTO_EGYSEGEK: ['spear', 'sword', 'axe', 'archer'] },
		[sliceFn(SZEM4_SRC, 'scavengeBaseOk'), sliceFn(SZEM4_SRC, 'scavengeAllapot')]
	);

	function base(lootFactor) {
		return { loot_factor: lootFactor, duration_exponent: 0.45,
		         duration_initial_seconds: 1800, duration_factor: 0.7237692407143577 };
	}
	function kepernyo(extra) {
		var falu = {
			unit_carry_factor: 1,
			unit_counts_home: { spear: 52, sword: 51, axe: 250, light: 100, spy: 20 },
			options: {
				1: { is_locked: false, scavenging_squad: null, base: base(0.1) },
				2: { is_locked: false, scavenging_squad: null, base: base(0.25) },
				3: { is_locked: false, scavenging_squad: { return_time: 1788694401 }, base: base(0.5) },
				4: { is_locked: true, scavenging_squad: null, base: base(0.75) }
			}
		};
		for (var k in (extra || {})) falu[k] = extra[k];
		return { ScavengeScreen: { village: falu } };
	}

	var most = api.scavengeAllapot(kepernyo());
	eq(most.opciok.map(function (o) { return o.id; }), [1, 2],
	   'only the options that are unlocked and standing empty can be sent on');
	eq(most.opciok[0].base.loot_factor, 0.1,
	   'and each one carries its own arithmetic, so the world is never written down here');

	/* The pool is the number the whole plan is sized from, and it is exactly the
	   figure his account produced: 52 spear, 51 sword and 250 axe. */
	eq(most.teherPool, 4565, 'the troops at home price out as the carry his own village has');
	eq(most.elerheto, { spear: 52, sword: 51, axe: 250, archer: 0 },
	   'the cavalry and the scouts are not even offered to the planner');
	eq(most.opcioSzam, 4,
	   'every option is counted, because the send buttons are found by position');

	/* A world multiplier on carry. His is 1, so this is the case that would
	   otherwise be wrong everywhere and visible nowhere. */
	eq(api.scavengeAllapot(kepernyo({ unit_carry_factor: 2 })).teherPool, 9130,
	   'a world that multiplies carry is priced with the multiplier, not without it');
	eq(api.scavengeAllapot(kepernyo({ unit_carry_factor: 2 })).szorzo, 2,
	   'and it is handed on, so a capacity can be turned back into troops');
	eq(api.scavengeAllapot(kepernyo({ unit_carry_factor: undefined })).teherPool, 4565,
	   'a world that does not state one is not multiplied by nothing');

	/* --- total: this runs against a window that may be mid-navigation --- */
	var romlott = kepernyo();
	romlott.ScavengeScreen.village.options[2].base = {};
	eq(api.scavengeAllapot(romlott).opciok.map(function (o) { return o.id; }), [1],
	   'an option missing its constants is left out instead of poisoning the plan');
	ok(api.scavengeAllapot({}) === null, 'a window with no scavenge screen on it says so');
	ok(api.scavengeAllapot(null) === null, 'and so does no window at all');
	var ureskeny;
	try { ureskeny = api.scavengeAllapot(kepernyo({ unit_counts_home: undefined })).teherPool; }
	catch (e) { ureskeny = 'threw: ' + e.message; }
	ok(ureskeny === 0,
	   'a village with no troop counts has nothing to send, rather than NaN to send it with');
});

/* ------------------------------------------------------------------------ */
/* The send itself -- the line where troops actually leave the village.

   The screen carries one shared set of troop boxes and one button per option,
   and the button for option N is the Nth of them. The fake window below is
   built to the shape the game's own helper script uses: a jQuery that can
   select the boxes and wrap one, and buttons that record being clicked. */
suite('When the gatherer sends a squad out', function () {
	var naplozott = [];
	var api = sandbox({ debug: function (hol, mit) { naplozott.push(hol + ': ' + mit); } }, [
		sliceFn(SZEM4_SRC, 'scavengeUrlapKitolt'),
		sliceFn(SZEM4_SRC, 'scavengeIndit')
	]);

	function ablak(beallit) {
		beallit = beallit || {};
		var irt = [], esemenyek = [], kattintott = [];
		var mezok = (beallit.mezok || ['spear', 'sword', 'axe', 'light', 'spy'])
			.map(function (nev) { return { name: nev }; });
		/* The real screen, read off his account: a card per option, and a card
		   with nothing to start carries NO button at all -- four cards, three
		   buttons. `null` below is such a card. */
		var kartyak = (beallit.gombok || [[], [], [], null]).map(function (osztalyok, i) {
			var gomb = osztalyok && {
				classList: { contains: function (c) { return osztalyok.indexOf(c) !== -1; } },
				click: function () { kattintott.push(i + 1); }
			};
			return { querySelector: function () { return gomb || null; } };
		});
		function $(mi) {
			if (typeof mi === 'string') {
				return { each: function (cb) { mezok.forEach(function (m) { cb.call(m); }); } };
			}
			return {
				val: function (v) { irt.push([mi.name, v]); return this; },
				trigger: function (nev) { esemenyek.push([mi.name, nev]); return this; }
			};
		}
		return {
			$: beallit.nincsJquery ? null : $,
			document: { querySelectorAll: function () { return kartyak; } },
			irt: irt, esemenyek: esemenyek, kattintott: kattintott
		};
	}

	var w = ablak();
	var ment = api.scavengeIndit(w, 3, { spear: 52, axe: 250 }, 4);
	ok(ment === true,
	   'a squad is sent even though one option carries no button -- the live case that sent nothing');
	eq(w.kattintott, [3], 'and it is the third option that starts, not whichever button came first');

	/* An option with no button of its own is refused, never answered with some
	   other option's button. This is what breaks once squads are out: an option
	   already gathering has nothing to start. */
	var zart = ablak();
	ok(api.scavengeIndit(zart, 4, { spear: 10 }, 4) === false,
	   'an option with no button of its own is left alone');
	eq(zart.kattintott, [], 'and no other option is started in its place');
	eq(zart.irt, [], 'nor are troops typed in for a send that cannot happen');
	ok((naplozott[naplozott.length - 1] || '').indexOf('4. gyűjtögetési') !== -1,
	   'and the refusal is written down, naming the option that was skipped');

	/* The boxes are shared between the options, so anything left in them from
	   the last send goes out with this one unless every box is written. */
	eq(w.irt, [['spear', 52], ['sword', 0], ['axe', 250], ['light', 0], ['spy', 0]],
	   'every box is written, so nothing left over from the last send rides along');
	eq(w.esemenyek.length, 5,
	   'and each one is changed rather than only set, which is what the game reads');

	/* --- the refusals: each one must leave the troops at home --- */
	var tiltott = ablak({ gombok: [[], [], ['btn-disabled'], []] });
	ok(api.scavengeIndit(tiltott, 3, { spear: 10 }, 4) === false,
	   'an option the game has disabled is not clicked');
	eq(tiltott.irt, [], 'and its squad is never even typed into the form');

	/* Five options, four buttons: position 3 still holds a button, just not the
	   one option 3 is. Only the count says so. */
	var eltolodott = ablak({ gombok: [[], [], [], []] });
	ok(api.scavengeIndit(eltolodott, 3, { spear: 10 }, 5) === false,
	   'a screen not showing a button per option is refused, not aimed at the wrong one');
	eq(eltolodott.kattintott, [], 'so no option is started by guesswork');
	/* This is the shape the live failure took: a screen the code did not expect,
	   refusing everything, looking from the outside exactly like a gatherer
	   with nothing to do. It must never be silent again. */
	ok((naplozott[naplozott.length - 1] || '').indexOf('4 lehetőség') !== -1
	   && (naplozott[naplozott.length - 1] || '').indexOf('5 opciót') !== -1,
	   'and a screen that does not match the game says so, with both counts');

	var uresUrlap = ablak({ mezok: [] });
	api.scavengeIndit(uresUrlap, 2, { spear: 10 }, 4);
	ok((naplozott[naplozott.length - 1] || '').indexOf('egyetlen egység sem') !== -1,
	   'and so does a send that would have gone out with an empty form');

	var ures = ablak();
	ok(api.scavengeIndit(ures, 2, {}, 4) === false, 'an empty squad is not sent');
	eq(ures.kattintott, [], 'and nothing is clicked with an empty form');

	/* --- total: the window is a game page that may be reloading under us --- */
	var hiba;
	try {
		hiba = [api.scavengeIndit(null, 1, { spear: 5 }, 4),
		        api.scavengeIndit(ablak({ gombok: [] }), 1, { spear: 5 }, 4),
		        api.scavengeIndit(ablak({ nincsJquery: true }), 1, { spear: 5 }, 4)];
	} catch (e) { hiba = 'threw: ' + e.message; }
	eq(hiba, [false, false, false],
	   'a window that is gone, empty or still loading is a refusal rather than a crash');
});

/* ------------------------------------------------------------------------ */
/* The whole visit, driven end to end: read the screen, plan the round, size
   each squad, fill the form, click. A pure planner that is never called is the
   likeliest way a feature like this fails, so this suite runs the real chain
   against a fake game window rather than testing the pieces again.

   The tick loop is real too: the engine sends one option per tick and is
   re-entered, so each call below is one tick of the gatherer. */
suite('A whole gathering visit under the aligned strategy', function () {
	function base(lootFactor) {
		return { loot_factor: lootFactor, duration_exponent: 0.45,
		         duration_initial_seconds: 1800, duration_factor: 0.7237692407143577 };
	}

	/* His own village: 52 spear, 51 sword, 250 axe -- 4565 carry -- plus farm
	   cavalry that must stay home. Options 1-3 unlocked, 4 not bought. */
	function vilag(beallit) {
		beallit = beallit || {};
		var opciok = {
			1: { is_locked: false, scavenging_squad: null, base: base(0.1) },
			2: { is_locked: false, scavenging_squad: null, base: base(0.25) },
			3: { is_locked: false, scavenging_squad: null, base: base(0.5) },
			4: { is_locked: true, scavenging_squad: null, base: base(0.75) }
		};
		for (var k in (beallit.opciok || {})) opciok[k] = beallit.opciok[k];

		var irt = [], kattintott = [], naplozott = [], mezok =
			['spear', 'sword', 'axe', 'light'].map(function (n) { return { name: n }; });
		/* Mirrors his real screen: a card per option, and the locked fourth
		   carries no button at all. Modelling four buttons here is what let the
		   first version of this feature pass every test and send nothing. */
		var kartyak = [1, 2, 3, 4].map(function (id) {
			var gomb = opciok[id].is_locked ? null
				: { classList: { contains: function () { return false; } },
				    click: function () { kattintott.push(id); } };
			return { querySelector: function () { return gomb; } };
		});
		function $(mi) {
			if (typeof mi === 'string') {
				return { each: function (cb) { mezok.forEach(function (m) { cb.call(m); }); } };
			}
			return { val: function (v) { irt.push([mi.name, v]); return this; },
			         trigger: function () { return this; } };
		}
		var ablak = {
			$: $,
			document: { querySelectorAll: function () { return kartyak; } }
		};
		if (!beallit.nincsKepernyo) {
			ablak.ScavengeScreen = { village: {
				unit_carry_factor: 1,
				unit_counts_home: beallit.otthon || { spear: 52, sword: 51, axe: 250, light: 100 },
				options: opciok
			} };
		}
		var cella = { innerHTML: '' };
		return {
			TEHER: { spear: 25, sword: 15, axe: 10, archer: 10, spy: 0, light: 80 },
			TANYA: { spear: 1, sword: 1, axe: 1, archer: 1, spy: 2, light: 4 },
			GYUJTO_REF: ablak,
			GYUJTO_DATA: 4242,
			GYUJTO_VILLINFO: { 4242: { retry: false } },
			GYUJTO_STATE: 2,
			GYUJTO_HIBA: 7,
			SZEM4_GYUJTO: { settings: { strategy: 'egyutt' } },
			document: { querySelector: function () { return { cells: [0, 0, 0, 0, cella] }; } },
			debug: function (hol, mit) { naplozott.push(hol + ': ' + mit); },
			pageUrl: function () { return 'screen=place&mode=scavenge'; },
			getServerTime: function () {},
			irt: irt, kattintott: kattintott, naplozott: naplozott, cella: cella
		};
	}
	function motor(w) {
		return sandbox(w, [
			sliceFn(SZEM4_SRC, 'countdownSeconds'),
			sliceFrom(SZEM4_SRC, 'var GYUJTO_URES_MS', 'scavengeNextVisitMs'),
			sliceFn(SZEM4_SRC, 'scavengeBaseOk'),
			sliceFn(SZEM4_SRC, 'scavengeDurationSec'),
			sliceFn(SZEM4_SRC, 'scavengeMinDurationSec'),
			sliceFn(SZEM4_SRC, 'scavengeCapacityFor'),
			sliceFn(SZEM4_SRC, 'scavengeHaul'),
			sliceFrom(SZEM4_SRC, 'var GYUJTO_MAX_FUTAS_MP', 'scavengeTerv'),
			sliceFrom(SZEM4_SRC, 'var GYUJTO_EGYSEGEK', 'scavengeEgysegek'),
			sliceFn(SZEM4_SRC, 'scavengeAllapot'),
			sliceFn(SZEM4_SRC, 'scavengeUrlapKitolt'),
			sliceFn(SZEM4_SRC, 'scavengeIndit'),
			sliceFn(SZEM4_SRC, 'szem4_GYUJTO_egyutt')
		]);
	}

	/* --- an empty village: nothing is out, so the round is ours to shape --- */
	var w = vilag(), api = motor(w);
	var elso = Date.now();
	ok(api.szem4_GYUJTO_egyutt() === true, 'the first tick of a visit sends a squad');
	eq(w.kattintott.length, 1, 'exactly one option per tick, because the troop boxes are shared');
	api.szem4_GYUJTO_egyutt();
	eq(w.kattintott, [3, 2],
	   'the best option is filled first, and the weak 10% one is left out entirely');

	/* Nothing left to send: the visit closes and books its own return. */
	ok(api.szem4_GYUJTO_egyutt() === true, 'and the visit finishes itself');
	eq(w.kattintott, [3, 2], 'without sending anything a fourth time');
	eq(w.GYUJTO_STATE, 0, 'the gatherer is free to move on to the next village');
	eq(w.GYUJTO_HIBA, 0, 'and the visit counts as a clean one');
	ok(w.GYUJTO_VILLINFO[4242].returned > elso + 3000000,
	   'the next visit is booked for when the squads land, about an hour out');
	ok(w.cella.innerHTML.length > 0, 'and the panel says when that is');
	ok(w.GYUJTO_VILLINFO[4242].terv === null,
	   'the spent plan is cleared, so the next visit plans against fresh troops');

	/* The troops themselves: the farm's cavalry is the thing that must never
	   go, and it is written to zero rather than merely left out. */
	/* The two squads are picked out of one reading of the troops, so together
	   they can never spend more than the village actually holds -- the page
	   cannot be relied on to have taken the first squad off its own counts by
	   the time the second is filled. */
	var kuldottLandzsa = w.irt.filter(function (p) { return p[0] === 'spear'; })
	                          .reduce(function (a, p) { return a + p[1]; }, 0);
	ok(kuldottLandzsa <= 52,
	   'the second squad takes what the first one left, not the whole village over again');

	var lovas = w.irt.filter(function (p) { return p[0] === 'light'; });
	ok(lovas.length > 0 && lovas.every(function (p) { return p[1] === 0; }),
	   'the farm cavalry is zeroed into the form on every send, never sent');

	/* --- a squad already out: the new ones are cut to land with it --- */
	var kint = vilag({ opciok: { 3: { is_locked: false, base: base(0.5),
		scavenging_squad: { return_time: Math.round(Date.now() / 1000) + 2400 } } } });
	var kintApi = motor(kint);
	kintApi.szem4_GYUJTO_egyutt();
	kintApi.szem4_GYUJTO_egyutt();
	kintApi.szem4_GYUJTO_egyutt();
	eq(kint.kattintott, [2, 1],
	   'with the good option busy the round is made up of the ones still free');
	var celzott = kint.GYUJTO_VILLINFO[4242].returned;
	ok(celzott > Date.now() + 2300000 && celzott < Date.now() + 2600000,
	   'and they are sized to land with the squad already out, not on their own schedule');

	/* --- the cap, which is what keeps a garrison at home --- */
	/* A late-game army would otherwise run for half a day, and scavenging
	   spends the very units that defend the village. */
	var hadsereg = vilag({ otthon: { spear: 4000, sword: 4000, axe: 4000 } });
	hadsereg.SZEM4_GYUJTO.settings.maxora = 2;
	var hadApi = motor(hadsereg);
	while (hadApi.szem4_GYUJTO_egyutt() && hadsereg.GYUJTO_STATE === 2) { /* run the visit out */ }
	var zaras = hadsereg.GYUJTO_VILLINFO[4242].returned;
	ok(zaras < Date.now() + 2.5 * 3600000,
	   'a two-hour cap is what a big army is planned against, not the eight-hour default');
	ok(zaras > Date.now() + 1.5 * 3600000,
	   'and it is used up to the cap rather than cut short of it');

	/* --- a window shorter than any run that exists --- */
	/* No squad can run for less than about 22 minutes whatever its size, so a
	   squad landing in ten cannot be joined. His call was to send the shortest
	   run anyway and let it land late rather than leave the troops standing --
	   and then to come back for the squad that lands FIRST, which here is the
	   one already out, not the ones just sent. */
	var szuk = vilag({ opciok: { 3: { is_locked: false, base: base(0.5),
		scavenging_squad: { return_time: Math.round(Date.now() / 1000) + 600 } } } });
	var szukApi = motor(szuk);
	szukApi.szem4_GYUJTO_egyutt();
	szukApi.szem4_GYUJTO_egyutt();
	szukApi.szem4_GYUJTO_egyutt();
	ok(szuk.kattintott.length > 0, 'a window too short for any run still sends, rather than idling');
	var korai = szuk.GYUJTO_VILLINFO[4242].returned;
	ok(korai < Date.now() + 700000,
	   'and the gatherer comes back for the squad landing first, not for the ones it just sent');

	/* --- nothing to do here --- */
	var szegeny = vilag({ otthon: { spear: 1 } });
	var szegenyApi = motor(szegeny);
	ok(szegenyApi.szem4_GYUJTO_egyutt() === true, 'a village with no troops still closes its visit');
	eq(szegeny.kattintott, [], 'and sends nobody');
	ok(szegeny.GYUJTO_VILLINFO[4242].returned > Date.now() + 1000000,
	   'booking a look much later rather than reopening the page every second');

	/* --- total: the screen may not be readable, and troops must still go --- */
	var vak = vilag({ nincsKepernyo: true });
	var vakApi = motor(vak);
	ok(vakApi.szem4_GYUJTO_egyutt() === false,
	   'an unreadable screen hands the visit back to the helper script instead of stalling');
	eq(vak.kattintott, [], 'nothing is sent on a screen that could not be read');
	ok((vak.naplozott[0] || '').indexOf('szem4_GYUJTO_egyutt') === 0,
	   'and it says so in the debug log rather than failing silently');

	/* Wiring. A planner nothing calls is the likeliest way this feature fails,
	   and the call has to sit ABOVE the old button walk: below it, the helper
	   script's own squad would already have gone out. */
	var elindit = codeOnly(sliceFn(SZEM4_SRC, 'szem4_GYUJTO_3elindit'));
	var hivas = elindit.indexOf('szem4_GYUJTO_egyutt()');
	ok(hivas !== -1, 'the gatherer engine actually calls it, or the strategy is unreachable');
	ok(hivas !== -1 && hivas < elindit.indexOf('free_send_button'),
	   'and it decides before the old path sends anything of its own');

	/* A visit that was cut short -- the motor restarts the window after 30
	   failed checks -- must not leave its plan behind to be spent later
	   against troops and a deadline that have both moved on. */
	var kereso = { KTID: { '500|500': 4242 },
		SZEM4_GYUJTO: { 4242: true, settings: { strategy: 'egyutt' } },
		GYUJTO_VILLINFO: { 4242: { retry: false, terv: [{ id: 3, egysegek: { spear: 52 } }] } },
		GYUJTO_STATE: 0, GYUJTO_DATA: null, GYUJTO_REF: null, GYUJTO_HIBA: 0, AZON: 'p_w',
		windowOpener: function () { return { document: {} }; },
		gameUrl: function () { return 'screen=place&mode=scavenge'; },
		debug: function () {} };
	sandbox(kereso, [sliceFn(SZEM4_SRC, 'szem4_GYUJTO_1keres')]).szem4_GYUJTO_1keres();
	eq(kereso.GYUJTO_DATA, 4242, 'a village whose gathering is due gets the visit');
	ok(kereso.GYUJTO_VILLINFO[4242].terv === null,
	   'and every visit starts by throwing away any plan left over from a broken one');
});

/* ------------------------------------------------------------------------ */
/* How full the armies come home is measured from the reports, not guessed at
   on the way out. What is still worth counting here is how many attempts
   became attacks, and why the rest did not -- a plan the minimum-army floor
   refused never produces a report, so it is invisible in the fill rate and
   has to be counted where it dies.

   Both recorders sit on the live attack path, so both are total: a throw here
   would skip the send that follows it. */
suite('farmolo -- a sereg meretenek merese', function () {
	function ures() {
		return { kezdet: 0, kuldes: 0, minsereg: 0, keves: 0,
		         jelentes: 0, zsakmany: 0, jelTeher: 0, tele: 0,
		         pop: 0, popMinta: 0, u_spear: 0, u_sword: 0, u_axe: 0,
		         u_archer: 0, u_light: 0, u_marcher: 0, u_heavy: 0 };
	}
	function api(stat) {
		var w = { SZEM4_FARM: arguments.length ? { STAT: stat } : { STAT: ures() } };
		var a = sandbox(w, [sliceFn(SZEM4_SRC, 'farmStatKuldes'),
		                    sliceFn(SZEM4_SRC, 'farmStatElakadt')]);
		a.stat = w.SZEM4_FARM.STAT;
		return a;
	}

	/* The shape has to survive the default state, or every counter reads
	   undefined on a fresh install and the panel reports nonsense. */
	var alap = sandbox({}, [sliceFn(SZEM4_SRC, 'defaultFarmState')]).defaultFarmState();
	eq(Object.keys(alap.STAT).sort(),
	   ['jelTeher', 'jelentes', 'keves', 'kezdet', 'kuldes', 'minsereg',
	    'pop', 'popMinta', 'tele', 'u_archer', 'u_axe', 'u_heavy', 'u_light',
	    'u_marcher', 'u_spear', 'u_sword', 'zsakmany'],
	   'a fresh farm state carries every counter the panel reads');

	var a = api();
	a.farmStatKuldes();
	a.farmStatKuldes();
	eq(a.stat.kuldes, 2, 'every attack that actually goes out is counted');

	/* The clock is handed in rather than read off the machine: two real
	   Date.now() calls can land in the same millisecond, and a mutation that
	   reset the start on every send would then pass unnoticed. */
	var ora = 1000;
	var dw = { SZEM4_FARM: { STAT: ures() }, Date: { now: function () { return ora; } } };
	var d = sandbox(dw, [sliceFn(SZEM4_SRC, 'farmStatKuldes'),
	                     sliceFn(SZEM4_SRC, 'farmStatElakadt')]);
	d.farmStatKuldes();
	eq(dw.SZEM4_FARM.STAT.kezdet, 1000, 'counting records when it started');
	ora = 99000;
	d.farmStatKuldes();
	eq(dw.SZEM4_FARM.STAT.kezdet, 1000, 'and the start is not moved by later sends');

	/* The two ways a plan dies in step 2 call for opposite answers -- lower the
	   floor, or field more troops -- so they cannot share a counter. */
	var e = api();
	e.farmStatElakadt(true);
	eq(e.stat.minsereg, 1, 'a plan refused by the minimum-army floor is counted as that');
	eq(e.stat.keves, 0, 'and not as a shortage of troops');
	e.farmStatElakadt(false);
	eq(e.stat.keves, 1, 'a plan with too few units to carry a load is counted separately');
	eq(e.stat.minsereg, 1, 'without disturbing the other reason');

	/* An install that predates this has no STAT in its saved farm data. */
	var f = sandbox({ SZEM4_FARM: {} }, [sliceFn(SZEM4_SRC, 'farmStatKuldes'),
	                                     sliceFn(SZEM4_SRC, 'farmStatElakadt')]);
	var dobott = false;
	try { f.farmStatKuldes(); f.farmStatElakadt(true); } catch (err) { dobott = true; }
	ok(!dobott, 'an install with no counters yet records nothing rather than throwing mid-attack');

	/* The counters are worthless unless they are actually called. */
	var kuldo = sliceFn(SZEM4_SRC, 'szem4_farmolo_3egyeztet');
	ok(codeOnly(kuldo).indexOf('farmStatKuldes()') !== -1,
	   'every attack sent is counted, on the line that sends it');

	var illeszto = sliceFn(SZEM4_SRC, 'szem4_farmolo_2illeszto');
	ok(codeOnly(illeszto).indexOf('farmStatElakadt(') !== -1,
	   'a plan abandoned in step 2 is counted, with the reason it died');
});

/* ------------------------------------------------------------------------ */
/* ------------------------------------------------------------------------ */
/* Min sereg/falu is set in population, so the panel cannot recommend a value
   for it without knowing what the armies in the reports actually cost. The
   markup here is copied from his saved report: three rows, unit icons then
   the quantity sent then the losses, and BOTH count rows carry
   data-unit-count. */
suite('farmolo -- mekkora sereg hozta haza', function () {
	/* The real population table, sliced out rather than retyped: a recommen-
	   dation measured against a made-up cost table would be measured against
	   nothing. */
	var tanyaKezd = SZEM4_SRC.indexOf('TANYA = {');
	var tanyaSrc = 'var ' + SZEM4_SRC.slice(tanyaKezd, matchBraces(SZEM4_SRC, tanyaKezd)) + ';';
	var api = sandbox({}, [tanyaSrc, sliceFn(SZEM4_SRC, 'jelentesNepesseg')],
	                  { tanya: 'TANYA' });

	function cella(tipus, db) {
		return '<td data-unit-count="' + db + '" class="unit-item unit-item-' + tipus +
		       (db ? '' : ' hidden') + '">' + db + '</td>';
	}
	function sor(mit) {
		var h = '<td width="20%">x</td>';
		for (var t in mit) h += cella(t, mit[t]);
		return '<tr>' + h + '</tr>';
	}
	/* The icon row carries no counts at all -- that is what makes the search
	   for the first counting row land on the quantity. */
	var ikonSor = '<tr class="center"><td></td>' +
		'<td><a class="unit_link" href="#" data-unit="light"><img alt="" /></a></td></tr>';
	function doc(sorok) {
		var wrap = document.createElement('div');
		wrap.innerHTML = '<table id="attack_info_att_units">' + sorok + '</table>';
		return { getElementById: function (id) { return wrap.querySelector('[id="' + id + '"]'); } };
	}

	eq(api.tanya().light, 4, 'the real cost table is the one being used');

	/* His own report: five light cavalry, which is the 20 population he has
	   Min sereg/falu set to. */
	eq(api.jelentesNepesseg(doc(ikonSor + sor({ spear: 0, light: 5 }))),
	   { pop: 20, egysegek: { light: 5 } },
	   'the army that went is priced in population, and its mix kept');

	/* The row of losses repeats every class the quantity row has. Summing the
	   whole table would charge him for the dead a second time. */
	eq(api.jelentesNepesseg(doc(ikonSor + sor({ light: 5 }) + sor({ light: 3 }))).pop, 20,
	   'the losses row underneath is not added to the army that was sent');

	var vegyes = api.jelentesNepesseg(doc(ikonSor + sor({ spear: 10, light: 5, heavy: 2 })));
	eq(vegyes.pop, 42, 'a mixed army is priced unit by unit');
	eq(vegyes.egysegek, { spear: 10, light: 5, heavy: 2 },
	   'and every type in it is kept, so the advice can be given in units');

	/* The scout rides along with the farm attack when Kem/falu is set, so it
	   is on nearly every one of his reports -- but it carries nothing and it
	   is attached after the army is planned, so it was never part of the
	   Min sereg/falu floor either. Counting its 2 population would state the
	   recommendation in different units from the setting it recommends. */
	var kemmel = api.jelentesNepesseg(doc(ikonSor + sor({ spy: 1, light: 5 })));
	eq(kemmel.pop, 20, 'the scout riding along is not counted as part of the army');
	ok(!('spy' in kemmel.egysegek), 'and does not appear in the mix either');
	ok(api.jelentesNepesseg(doc(ikonSor + sor({ spy: 3 }))) === null,
	   'and a pure scouting run is not an army at all');

	/* Rams and catapults have no population figure here, and an army carrying
	   them was not sent to farm. Pricing what is left would understate it --
	   and an understated army recommends sending fewer troops, the one
	   direction this must never guess in. */
	ok(api.jelentesNepesseg(doc(ikonSor + sor({ light: 5, ram: 3 }))) === null,
	   'an army with a unit we cannot price is skipped rather than half-counted');
	eq(api.jelentesNepesseg(doc(ikonSor + sor({ light: 5, ram: 0 }))).pop, 20,
	   'though a column merely showing a zero of one is not that');

	ok(api.jelentesNepesseg(doc(ikonSor)) === null,
	   'a report with no counts in it yields nothing');
	ok(api.jelentesNepesseg(doc(ikonSor + sor({ light: 0 }))) === null,
	   'and neither does an army of nobody');
	ok(api.jelentesNepesseg({ getElementById: function () { return null; } }) === null,
	   'nor does a report with no unit table at all');
});

/* ------------------------------------------------------------------------ */
/* The counters only help if they resolve into one of two opposite answers:
   send fewer units per attack, or field more of them. The thresholds live in
   the source rather than here, so this pins the readings that separate those
   answers -- particularly the two the fill rate cannot show on its own: a
   floor quietly refusing sends, and armies filling to the brim. */
suite('farmolo -- mit mondanak a szamlalok', function () {
	var api = sandbox({}, [sliceFrom(SZEM4_SRC, 'var STAT_MIN_MINTA', 'farmStatErtekeles')],
	                  { szoveg: 'STAT_SZOVEG', minMinta: 'STAT_MIN_MINTA' });
	function stat(o) {
		var s = { kezdet: 1, kuldes: 0, minsereg: 0, keves: 0,
		          jelentes: 0, zsakmany: 0, jelTeher: 0, tele: 0,
		          pop: 0, popMinta: 0, u_spear: 0, u_sword: 0, u_axe: 0,
		          u_archer: 0, u_light: 0, u_marcher: 0, u_heavy: 0 };
		for (var k in o) s[k] = o[k];
		return s;
	}

	var semmi = api.farmStatErtekeles(stat({}));
	eq(semmi.szint, 'nincs', 'with no report read yet the panel does not pretend to advise');
	/* ok(=== null), not eq: JSON.stringify(NaN) is "null", so eq would pass on
	   a division that produced NaN -- the very thing this guards. */
	ok(semmi.toltes === null, 'and reports no percentage rather than a NaN');

	/* Attacks going out is not the same evidence as reports coming back: the
	   fill rate is measured from the latter, so that is what has to be
	   sampled before advising. */
	var csakKuldes = api.farmStatErtekeles(stat({ kuldes: 200 }));
	eq(csakKuldes.szint, 'nincs', 'attacks sent but no reports read yet is still nothing to measure');

	var keves = api.farmStatErtekeles(stat({ jelentes: 5, jelTeher: 2000, zsakmany: 200 }));
	eq(keves.szint, 'keves_adat', 'a handful of reports is not enough to move troops on');

	var hatar = api.farmStatErtekeles(stat({ jelentes: api.minMinta(), jelTeher: 1000, zsakmany: 800 }));
	ok(hatar.szint !== 'keves_adat', 'the sample threshold is a floor to reach, not to pass');

	var laza = api.farmStatErtekeles(stat({ jelentes: 100, jelTeher: 40000, zsakmany: 12000 }));
	eq(laza.szint, 'nagy', 'armies coming home a third full means too many units per send');
	eq(Math.round(laza.toltes * 100), 30, 'and the percentage is the plain ratio of the two totals');

	/* The case the fill rate cannot see on its own: every army that got sent
	   was a good size, but a large share of attempts never became attacks
	   because the floor refused them -- and a refused plan files no report. */
	var padlo = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                         zsakmany: 32000, minsereg: 40 }));
	eq(padlo.szint, 'nagy', 'a floor refusing many sends is caught even when the armies that go are full');

	/* The opposite reading, and the one that must win: armies that come home
	   full were demonstrably too small, and answering that by sending fewer
	   units would be the costliest possible mistake. */
	var tele = api.farmStatErtekeles(stat({ jelentes: 100, jelTeher: 40000,
	                                        zsakmany: 32000, tele: 40 }));
	eq(tele.szint, 'tele', 'armies repeatedly coming home full means more units would earn more');
	eq(Math.round(tele.teleArany * 100), 40, 'and the share that filled up is reported as it is');

	var telePadlo = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                             zsakmany: 32000, tele: 40, minsereg: 40 }));
	eq(telePadlo.szint, 'tele', 'and it outranks the floor reading, which would say the opposite');

	var hiany = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                         zsakmany: 32000, keves: 40,
	                                         pop: 2000, popMinta: 100, u_light: 500 }));
	/* Running out of units mid-plan used to share a verdict with armies coming
	   home full, and the two want opposite answers: there the armies that went
	   were the right size, there were just not enough troops to build more of
	   them. Raising the floor would attack fewer villages with the same army. */
	eq(hiany.szint, 'keves_egy', 'running out of units mid-plan is its own reading, not the same one');
	ok(hiany.ajanlott === null,
	   'and it is answered with no number, because the floor is not what is wrong');

	var rendben = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                           zsakmany: 32000, tele: 5, minsereg: 5, keves: 5 }));
	eq(rendben.szint, 'rendben', 'a well-fitted army is left alone rather than nagged at');

	/* ---- the recommendation ---- */
	/* The identity it rests on: capacity is population times carry per
	   population, so scaling the average army by the share it actually filled
	   gives the population that would have come home full. 20 population
	   filling 60% of what it could carry says 12 would have done the same
	   work -- which is his real number, and the reason he asked for this. */
	var ajanl = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                         zsakmany: 24000, pop: 2000, popMinta: 100,
	                                         u_light: 500 }));
	eq(ajanl.ajanlott, 12, 'the recommendation is the average army scaled by how full it came home');
	/* Stated in the units he sends: 100 reports of 5 light cavalry is 20
	   population an army, and 12 population is three of them. */
	eq(ajanl.ajanlottEgysegek, { light: 3 },
	   'and it is also given as the army itself, in the units he farms with');

	/* 100 reports of 10 spearmen and 5 light cavalry: 30 population an army,
	   filling half of what it could carry, so 15 population is the size that
	   would have come home full -- and the same army at half the size. */
	var vegyesAjanl = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                               zsakmany: 20000, pop: 3000, popMinta: 100,
	                                               u_spear: 1000, u_light: 500 }));
	eq(vegyesAjanl.ajanlott, 15, 'a mixed army is scaled by the same measured fill');
	eq(vegyesAjanl.ajanlottEgysegek, { spear: 5, light: 3 },
	   'and comes back as an army, keeping the proportions it was sent in');

	/* Nothing to average means nothing to say -- and dividing by it would put
	   a NaN in the panel rather than an absence. */
	var nincsPop = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                            zsakmany: 24000 }));
	ok(nincsPop.ajanlott === null, 'with no army sizes read there is no recommendation');

	var korai = api.farmStatErtekeles(stat({ jelentes: 5, jelTeher: 2000, zsakmany: 1200,
	                                         pop: 100, popMinta: 5 }));
	ok(korai.ajanlott === null, 'and none while the sample is still too thin to advise on');

	/* The one it must refuse. A trip that came home full proves only that the
	   village held AT LEAST that much, so those trips are censored and hold
	   the measured fill below the truth -- exactly when the reading is that
	   the armies are too small. Scaling by it would advise sending fewer
	   troops at the very moment the evidence says send more. */
	var teleAjanl = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                                             zsakmany: 32000, tele: 40,
	                                             pop: 2000, popMinta: 100 }));
	eq(teleAjanl.szint, 'tele', 'armies coming home full is still read as too small');
	/* The step up. It cannot be measured -- a full army proves the village held
	   at least a load and never how much more -- so what is offered is a size
	   to try and measure again, and the one thing it must never be is smaller
	   than what he already sends. 20 average, a quarter more, is 25. */
	eq(teleAjanl.ajanlott, 25, 'a step up is offered instead, a quarter above the average army');
	ok(teleAjanl.ajanlott > 20, 'which is never below the army that is already going out');

	/* An army so small that a quarter of it rounds to nothing must still be
	   told to grow, or the advice on the smallest armies is to stay put. */
	var pici = api.farmStatErtekeles(stat({ kuldes: 100, jelentes: 100, jelTeher: 400,
	                                        zsakmany: 320, tele: 40, pop: 100, popMinta: 100 }));
	eq(pici.szint, 'tele', 'a tiny army coming home full is read the same way');
	eq(pici.ajanlott, 2, 'and a step that would round to standing still is rounded up instead');

	/* A verdict with no sentence would render as an empty panel. */
	var szoveg = api.szoveg();
	['nincs', 'keves_adat', 'nagy', 'tele', 'keves_egy', 'rendben'].forEach(function (k) {
		ok(!!szoveg[k] && szoveg[k].length > 10, 'the "' + k + '" reading has a sentence at all');
	});

	/* A reading he cannot act on is one he has to decode first, so each of
	   these is pinned to the action it exists to give him. The old wording
	   described every situation correctly and told him what to do about none
	   of them, which is the complaint these sentences were rewritten for. */
	['keves_adat', 'nagy', 'tele'].forEach(function (k) {
		ok(szoveg[k].indexOf('Min sereg/falu') !== -1,
		   'the "' + k + '" reading names the setting it is asking him to leave or change');
	});
	ok(szoveg.keves_egy.indexOf('Toborozz') === 0,
	   'the troop-shortage reading opens with recruiting, which is the answer to it');
	ok(szoveg.keves_egy.indexOf('Min sereg/falu') !== -1,
	   'and still says raising the floor is not');
	/* The reading that cost two rounds of "nothing is being measured": the
	   counters only move while the report analyser is running. */
	ok(szoveg.nincs.indexOf('Jelentés elemző') !== -1,
	   'the empty reading names the module that has to run to fill it');
	ok(szoveg.rendben.indexOf('nincs teendő') !== -1,
	   'and the healthy reading says outright that there is nothing to do');

	/* Changing the setting invalidates every counter collected under the old
	   one, so telling him to change it is not a finished instruction until it
	   also says to clear. He hit this for real: acted on the recommendation,
	   left the counters running, and the next reading quietly averaged two
	   policies -- which reads as a measurement rather than as a mixture. */
	['nagy', 'tele'].forEach(function (k) {
		ok(/nullázd/.test(szoveg[k]),
		   'the "' + k + '" reading also says to clear the counters after changing it');
	});

	/* Clearing has to be real: the counters describe the settings that were in
	   force while they ran, so they are cleared exactly when one changes. */
	var nw = { SZEM4_FARM: { STAT: stat({ kuldes: 9, jelentes: 4, jelTeher: 100, zsakmany: 50,
	                                      tele: 1, minsereg: 2, keves: 3 }) },
	           document: { getElementById: function () { return null; } } };
	var n = sandbox(nw, [sliceFn(SZEM4_SRC, 'defaultFarmState'),
	                     sliceFrom(SZEM4_SRC, 'var STAT_MIN_MINTA', 'farmStatNullaz')]);
	n.farmStatNullaz();
	eq(nw.SZEM4_FARM.STAT.kuldes, 0, 'clearing puts every counter back to nothing');
	eq(nw.SZEM4_FARM.STAT.minsereg, 0, 'including the reasons plans were abandoned');

	/* ---- what actually reaches the panel ---- */
	/* The verdict being right is not the same as it being shown. This paints
	   into a real element and reads the text back, because a recommendation
	   computed and then dropped on the floor is the failure this feature
	   would be most likely to have. */
	function kiir(stt) {
		var el = document.createElement('div');
		var w = { SZEM4_FARM: { STAT: stt },
		          document: { getElementById: function (id) { return id === 'farm_kapacitas' ? el : null; } } };
		sandbox(w, [sliceFrom(SZEM4_SRC, 'var STAT_MIN_MINTA', 'farmStatKiir')]).farmStatKiir();
		return el;
	}

	var panel = kiir(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000,
	                        zsakmany: 24000, pop: 2000, popMinta: 100, u_light: 500 }));
	ok(/60%/.test(panel.textContent), 'the panel shows the measured fill rate');
	var ajanlEl = panel.querySelector('.szem4_kapacitas_ajanlas');
	ok(ajanlEl && /Min sereg\/falu/.test(ajanlEl.textContent) && /12/.test(ajanlEl.textContent),
	   'and names the value it recommends for Min sereg/falu');

	ok(panel.querySelector('img[alt="light"]'),
	   'and draws the recommended army as the units themselves');

	var panelTele = kiir(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000, zsakmany: 32000,
	                            tele: 40, pop: 2000, popMinta: 100, u_light: 500 }));
	var teleEl = panelTele.querySelector('.szem4_kapacitas_ajanlas');
	ok(teleEl && /25/.test(teleEl.textContent),
	   'and when the armies come home full it names the step up rather than going quiet');

	var panelHiany = kiir(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000, zsakmany: 32000,
	                             keves: 40, pop: 2000, popMinta: 100, u_light: 500 }));
	/* Asked of the element, not the panel text: this verdict's own sentence
	   mentions the setting in order to say NOT to raise it, so a search of the
	   whole panel would find it and pass either way. */
	ok(!panelHiany.querySelector('.szem4_kapacitas_ajanlas'),
	   'but recommends no value when the shortage is of troops, not of army size');
	ok(/Min sereg\/falu/.test(panelHiany.textContent),
	   'while still explaining why raising it is the wrong answer there');

	/* This counter used to read "a minimum sereg miatt maradt el", which named
	   no control: he could not tell it was counting attacks his own floor
	   setting had cancelled. It spells the settings box now. */
	var panelPadlo = kiir(stat({ kuldes: 100, jelentes: 100, jelTeher: 40000, zsakmany: 24000,
	                             minsereg: 3, pop: 2000, popMinta: 100, u_light: 500 }));
	var reszlet = panelPadlo.querySelector('.szem4_kapacitas_reszlet');
	ok(reszlet && /3\D+nem indult el a Min sereg\/falu miatt/.test(reszlet.textContent),
	   'the blocked-send counter names the setting that blocked them',
	   reszlet && reszlet.textContent);

	/* The threshold is written into the sentence from the constant rather than
	   typed beside it, so the two cannot come to say different numbers. */
	var panelKeves = kiir(stat({ kuldes: 5, jelentes: 5, jelTeher: 2000, zsakmany: 1200,
	                             pop: 100, popMinta: 5, u_light: 25 }));
	var verdikt = panelKeves.querySelector('.szem4_kapacitas_verdikt');
	eq(verdikt.textContent.indexOf('{MINTA}'), -1, 'no placeholder survives into the panel');
	ok(verdikt.textContent.indexOf(String(api.minMinta())) !== -1,
	   'and the thin-sample reading states the real threshold', verdikt.textContent);

	/* Wiring: the reading is worthless if nothing ever paints it. */
	ok(SZEM4_SRC.indexOf('id="farm_kapacitas"') !== -1,
	   'the Farmolo panel has somewhere to show the reading');
	ok(SZEM4_SRC.indexOf('onclick="farmStatNullaz()"') !== -1,
	   'and a control to clear it when a setting changes');
	ok(codeOnly(sliceFn(SZEM4_SRC, 'szem4_farmolo_3egyeztet')).indexOf('farmStatKiir()') !== -1,
	   'the reading is repainted as each attack goes out');
	ok(codeOnly(sliceFn(SZEM4_SRC, 'rebuildDOM_farm')).indexOf('farmStatKiir()') !== -1,
	   'and on load, so saved counters are not invisible until the next send');
});

/* ------------------------------------------------------------------------ */
/* Read off his saved report (Desktop\Resource Haul.htm, a light-cavalry farm
   run with no spy along): the game renders #attack_spy_resources on that
   report all the same, holding only its own "send troops again" suggestion
   links. So the element's presence says "this village can be farmed", not
   "a spy saw something" -- and the analyser used to read it as the latter,
   sending every no-spy farm report down the scouting branch, where it found
   no reading and recorded the village as holding nothing. */
suite('VIJE -- kemadat van-e egyaltalan a jelentesen', function () {
	function doc(html) {
		var wrap = document.createElement('div');
		wrap.innerHTML = html;
		return {
			getElementById: function (id) { return wrap.querySelector('[id="' + id + '"]'); },
			querySelector: function (s) { return wrap.querySelector(s); }
		};
	}
	var api = sandbox({}, [sliceFn(SZEM4_SRC, 'getSpyResourceCell'),
	                       sliceFn(SZEM4_SRC, 'vanKemAdat')]);

	/* Mirrors the saved page: one row, a th, and farm suggestion links whose
	   title attribute happens to contain resource markup as text. */
	var csakAjanlat = doc(
		'<table id="attack_spy_resources">' +
		'<tr class="no-preview"><th>Lehetseges nyersanyagok:</th><td>' +
		'<span class="res-icons-separated"></span><br />' +
		'<a href="#" class="farm_tooltip farm_village_1748 farm_icon farm_icon_a" ' +
		'title="&lt;span class=&quot;icon header ressources&quot;&gt; &lt;/span&gt;800"></a>' +
		'<a href="#" class="farm_tooltip farm_village_1748 farm_icon farm_icon_b" ' +
		'title="&lt;span class=&quot;icon header ressources&quot;&gt; &lt;/span&gt;2.400"></a>' +
		'</td></tr></table>');
	ok(csakAjanlat.querySelector('#attack_spy_resources') !== null,
	   'the suggestion table is there on a report where no spy went -- this is the trap');
	ok(api.getSpyResourceCell(csakAjanlat) === null,
	   'and it holds no resource reading, only send-again links');
	eq(api.vanKemAdat(csakAjanlat), false,
	   'so the report counts as carrying no spy data');

	/* A real scouting report: the same table, with the reading added above the
	   suggestions. The suggestion rows must not hide it. */
	var kemJelentes = doc(
		'<table id="attack_spy_resources">' +
		'<tr><th>Nyersanyagok:</th><td>' +
		'<span class="nowrap"><span class="icon header wood" title="Fa"> </span>71</span> ' +
		'<span class="nowrap"><span class="icon header stone" title="Agyag"> </span>96</span> ' +
		'<span class="nowrap"><span class="icon header iron" title="Vas"> </span>71</span>' +
		'</td></tr>' +
		'<tr><th>Lehetseges nyersanyagok:</th><td>' +
		'<a href="#" class="farm_tooltip farm_icon farm_icon_a"></a>' +
		'</td></tr></table>');
	ok(api.getSpyResourceCell(kemJelentes) !== null,
	   'a real reading is still found when the suggestions sit beside it');
	eq(api.vanKemAdat(kemJelentes), true, 'and the report counts as scouted');

	/* Buildings are read on the same branch, so a report carrying levels must
	   stay on it even if the resource row is missing -- otherwise the fix
	   would trade one kind of lost data for another. */
	eq(api.vanKemAdat(doc('<input id="attack_spy_building_data" value="[]" />')), true,
	   'spied building data alone keeps the report on the scouting branch');
	eq(api.vanKemAdat(doc('<table id="attack_spy_buildings_left"></table>')), true,
	   'and so does the older two-table building markup');
	eq(api.vanKemAdat(doc('<table id="attack_results"></table>')), false,
	   'a report with neither is not treated as scouted');

	/* Wiring: the analyser must ask this question rather than the old one. */
	var elemzes = sliceFn(SZEM4_SRC, 'szem4_VIJE_2elemzes');
	ok(elemzes.indexOf('vanKemAdat(VIJE_REF2.document)') !== -1,
	   'the analyser branches on whether spy data is present');
	ok(elemzes.indexOf("querySelector('#attack_spy_resources')") === -1,
	   'and no longer on whether the suggestion table exists');
});

/* ------------------------------------------------------------------------ */
/* What the engine expected to find is a guess; the report is the fact. Every
   report of a completed attack states the haul next to the capacity that
   carried it -- "238/400" on his saved page -- so how full the armies come
   home can be read rather than inferred, and needs no matching back to the
   send that produced it. */
suite('farmolo -- a valos zsakmany a jelentesbol', function () {
	function doc(html) {
		var wrap = document.createElement('div');
		wrap.innerHTML = html;
		return { getElementById: function (id) { return wrap.querySelector('[id="' + id + '"]'); } };
	}
	function eredmeny(sorok) {
		return doc('<table id="attack_results">' + sorok + '</table>');
	}
	/* Mirrors the saved page: a th, the three resource figures, then the cell. */
	var fosztogatasSor =
		'<tr><th>Fosztogatas:</th>' +
		'<td width="250"><span class="nowrap"><span class="icon header wood"> </span>71</span> ' +
		'<span class="nowrap"><span class="icon header stone"> </span>96</span> ' +
		'<span class="nowrap"><span class="icon header iron"> </span>71</span> </td>' +
		'<td>238/400</td></tr>';

	var api = sandbox({}, [sliceFn(SZEM4_SRC, 'jelentesZsakmany')]);

	var valos = api.jelentesZsakmany(eredmeny(fosztogatasSor));
	eq(valos, { zsakmany: 238, teherbiras: 400 },
	   'the haul and the capacity that carried it are read off the report');

	/* Same trap as numFrom: the game prints a dot as the thousands separator,
	   and parseInt("2.400") is 2. A full 2400 army would otherwise read as an
	   army of 2 that came home overflowing. */
	var nagy = api.jelentesZsakmany(eredmeny('<tr><th>x</th><td>y</td><td>1.000/2.400</td></tr>'));
	eq(nagy, { zsakmany: 1000, teherbiras: 2400 },
	   'a dotted thousand in the haul is read whole');

	/* The table carries damage rows too when a wall or building was hit, and
	   the loot row is not always first. */
	var sok = api.jelentesZsakmany(
		eredmeny('<tr><th>Fal:</th><td>20. szintrol 18. szintre</td><td>rombolas</td></tr>' +
		         fosztogatasSor));
	eq(sok, { zsakmany: 238, teherbiras: 400 },
	   'the loot row is found by shape even when damage rows come first');

	ok(api.jelentesZsakmany(doc('<div></div>')) === null,
	   'a report with no results table yields nothing');
	ok(api.jelentesZsakmany(eredmeny('<tr><th>Fal:</th><td>a</td><td>rombolas</td></tr>')) === null,
	   'and so does one with no cell shaped like a haul');
	ok(api.jelentesZsakmany(eredmeny('<tr><th>x</th><td>y</td><td>0/0</td></tr>')) === null,
	   'a capacity of zero is refused rather than divided by later');

	/* ---- the recorder ---- */
	function rec(farmok) {
		var w = {
			SZEM4_FARM: {
				DOMINFO_FARMS: farmok === undefined ? { '527|466': {} } : farmok,
				STAT: { kezdet: 0, kuldes: 0, teher: 0, vart: 0, alul: 0, minsereg: 0,
				        keves: 0, jelentes: 0, zsakmany: 0, jelTeher: 0, tele: 0,
				        pop: 0, popMinta: 0, u_spear: 0, u_sword: 0, u_axe: 0,
				        u_archer: 0, u_light: 0, u_marcher: 0, u_heavy: 0 }
			},
			Date: { now: function () { return 5000; } }
		};
		var a = sandbox(w, [sliceFn(SZEM4_SRC, 'farmStatJelentes')]);
		a.stat = w.SZEM4_FARM.STAT;
		return a;
	}

	var r = rec();
	r.farmStatJelentes('527|466', 238, 400, { pop: 20, egysegek: { light: 5 } });
	eq(r.stat.jelentes, 1, 'a report about a farm is counted');
	eq(r.stat.zsakmany, 238, 'the real haul is recorded');
	eq(r.stat.jelTeher, 400, 'against the capacity that fetched it');
	eq(r.stat.tele, 0, 'an army with room to spare did not come home full');
	eq(r.stat.kezdet, 5000, 'and the measurement records when it began');
	eq(r.stat.pop, 20, 'the size of the army that fetched it is recorded too');
	eq(r.stat.popMinta, 1, 'against its own sample count');
	eq(r.stat.u_light, 5, 'and the units it was made of, by type');
	eq(r.stat.u_spear, 0, 'leaving the types that were not sent at nothing');

	/* Kept apart from the report count on purpose: if the unit table ever
	   moves, the fill rate must keep its sample rather than losing it to a
	   size that could not be read. */
	var p = rec();
	p.farmStatJelentes('527|466', 238, 400);
	p.farmStatJelentes('527|466', 238, 400, { pop: 0, egysegek: {} });
	eq(p.stat.jelentes, 2, 'a report whose army could not be sized still counts as a report');
	eq(p.stat.popMinta, 0, 'but not toward the sizes');
	eq(p.stat.pop, 0, 'and adds nothing to them');

	r.farmStatJelentes('527|466', 400, 400);
	eq(r.stat.tele, 1, 'an army that filled up is counted -- it left loot behind');
	eq(r.stat.zsakmany, 638, 'hauls accumulate');

	/* A haul larger than the army could carry is impossible; reading one means
	   the markup moved. Counting it would report a fill above 100%. */
	var t = rec();
	t.farmStatJelentes('527|466', 900, 400);
	eq(t.stat.zsakmany, 400, 'a haul beyond the capacity is capped at it');
	eq(t.stat.tele, 1, 'and still counts as coming home full');

	/* Reports arrive for hand-sent attacks at players too. Those armies were
	   not sized to a farm and would move the reading he acts on. */
	var k = rec({ '999|999': {} });
	k.farmStatJelentes('527|466', 238, 400);
	eq(k.stat.jelentes, 0, 'a report about a village not on the farm list is ignored');
	eq(k.stat.jelTeher, 0, 'and contributes nothing to the totals');

	var z = rec();
	z.farmStatJelentes('527|466', 238, 0);
	z.farmStatJelentes('527|466', 238, undefined);
	z.farmStatJelentes('527|466', undefined, 400);
	eq(z.stat.jelentes, 0, 'a report that could not be read is dropped, not counted as empty');

	/* Total: it runs inside the analyser, whose catch would turn a throw here
	   into "unreadable report" and lose the rest of the analysis. */
	var dobott = false;
	var u = sandbox({ SZEM4_FARM: {} }, [sliceFn(SZEM4_SRC, 'farmStatJelentes')]);
	try { u.farmStatJelentes('527|466', 238, 400); } catch (e) { dobott = true; }
	eq(dobott, false, 'recording never throws, even with no counters to write to');

	/* ---- the migration ---- */
	/* His install already stores a STAT from before these counters existed,
	   and the load merges one level deep, so the stored object replaces the
	   default entire. Without this the first ++ writes NaN, which saves and
	   reloads perfectly happily and reads back as a broken panel forever. */
	var mig = sandbox({}, [sliceFn(SZEM4_SRC, 'defaultFarmState'),
	                       sliceFn(SZEM4_SRC, 'upgradeFarmStat')]);
	var regi = mig.upgradeFarmStat({ kezdet: 7, kuldes: 40, teher: 16000, vart: 9000,
	                                 alul: 2, minsereg: 5, keves: 1 });
	eq(regi.jelentes, 0, 'a STAT saved before the report counters gains them');
	eq(regi.zsakmany, 0, 'each starting from nothing');
	eq(regi.kuldes, 40, 'while the counters it already had are left alone');
	eq(regi.teher, 16000, 'with their totals intact');

	var romlott = mig.upgradeFarmStat({ jelentes: NaN, zsakmany: 12 });
	eq(romlott.jelentes, 0, 'a counter already spoiled to NaN is repaired');
	eq(romlott.zsakmany, 12, 'without disturbing the ones that are sound');
	ok(typeof mig.upgradeFarmStat(undefined).jelentes === 'number',
	   'and a missing STAT comes back as a whole one');

	/* Wiring: none of this is worth anything if the analyser never calls it. */
	var elemzo = sliceFn(SZEM4_SRC, 'szem4_VIJE_2elemzes');
	ok(elemzo.indexOf('jelentesZsakmany(VIJE_REF2.document)') !== -1,
	   'the analyser reads the haul off every report it can');
	ok(elemzo.indexOf('farmStatJelentes(adatok[1]') !== -1,
	   'and records it against the village it came from');
	ok(codeOnly(elemzo).indexOf('jelentesNepesseg(VIJE_REF2.document)') !== -1,
	   'and reads the size of the army that fetched it, from the same report');

	/* The bug this suite could not see, and it made the whole reading useless
	   on his account: with Kem/falu set, SZEM sends a scout along with the
	   farm attack, so the farm reports ARE scouted reports. The measurement
	   used to live inside the branch for reports with no scouting data, which
	   meant it never ran once. Asserted by position: the call has to sit
	   ABOVE the branch, because sitting inside either side of it is exactly
	   the mistake -- and a call inside one arm still 'contains' the text. */
	var kemAg = codeOnly(elemzo).indexOf('vanKemAdat(VIJE_REF2.document)');
	var meres = codeOnly(elemzo).indexOf('farmStatJelentes(adatok[1]');
	ok(meres !== -1 && kemAg !== -1 && meres < kemAg,
	   'the haul is measured before the report is sorted into scouted or not');
	ok(codeOnly(sliceFn(SZEM4_SRC, 'szem4_ADAT_loadNow')).indexOf('upgradeFarmStat(') !== -1,
	   'a loaded farm state is brought up to the current counter shape');
});

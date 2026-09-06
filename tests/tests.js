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
	'add_farmolo', 'alert2', 'debug_urit', 'gyujto_setVill',
	'hattercsere', 'hattertolor', 'learnCatapult', 'loadCloudDataIntoLocal',
	'modosit_szam', 'naplo', 'nyit', 'onWallpChange',
	'playSound', 'removeTooltip', 'rendez', 'restartKieg',
	'saveLocalDataToCloud', 'saveSettings', 'selectTheme', 'setTooltip',
	'sortorol', 'stopEvent', 'sugo', 'switchMobileMode',
	'szem4_ADAT_LoadAll', 'szem4_ADAT_betolt', 'szem4_ADAT_del', 'szem4_ADAT_kiir',
	'szem4_ADAT_loadNow', 'szem4_ADAT_restart', 'szem4_ADAT_saveNow', 'szem4_EPITO_cscheck',
	'szem4_EPITO_csopDelete', 'szem4_EPITO_infoCell', 'szem4_EPITO_most', 'szem4_EPITO_perccsokkento',
	'szem4_EPITO_ujCsop', 'szem4_EPITO_ujFalu', 'szem4_GYUJTO_search', 'szem4_farmolo_csoport',
	'szem4_farmolo_multiclick', 'szem4_vije_forgot', 'szunet', 'szunetMind',
	'updateDefaultProdHour', 'validate'
];

function exportedNames() {
	var block = SZEM4_SRC.slice(SZEM4_SRC.indexOf('Object.assign(window, {'));
	block = block.slice(block.indexOf('{') + 1, block.indexOf('});'));
	return block.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
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

	/* PINNED, NOT ENDORSED: numFrom does not strip thousands separators the way
	   buildingCost does. Its two callers read unit counts, and whether the game
	   prints those as "1.234" is a question about the game's own markup that
	   has not been answered from a saved page yet. If it does, this is a bug
	   and this assertion is what will have to change. */
	eq(nf.numFrom(fakeEl('1.234')), 1, 'KNOWN: numFrom stops at the separator');
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
		VIJE_SYNC_REST_UNTIL: 0,
		ALL_EXTENSION: ['farm', 'vije', 'idtamad', 'epit', 'gyujto', 'adatok'],
		clock: 1000000000000,
		calls: [], alerts: [], logged: [], prompts: [], confirms: [],
		answers: [], confirmAnswer: true, ticker: null, tickMs: 0,
		img: { src: '', alt: '', title: '' },
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
		getElementById: function (id) { return id === 'szunet_mind' ? w.label : null; }
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
	var flags = { farm: w.FARM_PAUSE, vije: w.VIJE_PAUSE, epit: w.EPIT_PAUSE, gyujto: w.GYUJTO_PAUSE, adatok: w.ADAT_PAUSE };
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
	ok(w.img.src === 'PIC:play.png' && w.img.alt === 'Stop', 'the icon reports it is running');
	api.szunet('farm', w.img);
	ok(w.FARM_PAUSE === true && w.img.src === 'PIC:pause.png', 'and toggles back');
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
	eq(w.label.textContent, 'Szünet 30:00', 'the link becomes the countdown');
	eq(w.tickMs, 1000, 'and counts once a second');

	tick(w, 29 * 60000);
	eq(w.label.textContent, 'Szünet 1:00', 'the countdown counts down');
	eq(running(w), ['adatok'], 'still stopped');
	tick(w, 59000);
	eq(running(w), ['adatok'], 'not a second early');
	tick(w, 1000);
	eq(running(w), ['adatok', 'farm', 'gyujto', 'vije'], 'everything recorded restarts on time');
	ok(w.EPIT_PAUSE === true, 'what was already stopped stays stopped');
	eq(w.label.textContent, 'Szünet mind', 'the link goes back to normal');
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

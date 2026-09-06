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
	ok(css.indexOf('position: relative;\n\t\t\tbackground: var(--szem-surface-2);') !== -1,
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
	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; top:0; width:600px; height:200px;';
	document.body.appendChild(keret);
	var d = keret.contentDocument;
	d.open();
	d.write('<!doctype html><html><head><style>' + szemCss() + '</style></head><body></body></html>');
	d.close();

	var ikon = keret.contentWindow.eval('(' + sliceFn(SZEM4_SRC, 'modulIkon') + ')');

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
	var tartalek = puszta.contentWindow.eval('(' + sliceFn(SZEM4_SRC, 'modulIkon') + ')')(false);
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
	var keret = document.createElement('iframe');
	keret.style.cssText = 'position:absolute; left:-9999px; width:400px; height:120px;';
	document.body.appendChild(keret);
	var d = keret.contentDocument;
	d.open();
	d.write('<!doctype html><html><head><style>' + szemCss() + '</style></head><body></body></html>');
	d.close();

	var stop = keret.contentWindow.eval('(' + sliceFn(SZEM4_SRC, 'stopIkon') + ')')();
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

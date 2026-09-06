/* SZEM4 -- fork of cncDAni2/klanhaboru, maintained by elbeezy.
 * Wrapped in an IIFE so the script no longer leaks its internals into the
 * game page's window. The explicit export block below restores the exact
 * set of globals the generated HTML depends on. No logic is changed. */
;(function () {

/* ============================================================================
 * PUBLIC SURFACE
 *
 * The names below, and only these, are reached by resolving against window:
 * from inline handlers in the generated markup, from handlers attached with
 * setAttribute, from javascript: links, from string-form setTimeout, or from
 * the injected Firebase module. Everything else in this file is internal.
 *
 * Derived by scanning for those five patterns, then checked at runtime --
 * verifyInlineHandlers() re-reads the interface once it is built and reports
 * any handler naming something absent here. Without that, an omission would
 * surface only as a control that silently does nothing when clicked.
 * ========================================================================== */
Object.assign(window, {
	BotvedelemBe, BotvedelemKi, addTooltip_build, add_farmolando,
	add_farmolo, alert2, debug_urit, gyujto_setVill,
	hattercsere, hattertolor, learnCatapult, loadCloudDataIntoLocal,
	modosit_szam, naplo, nyit, onWallpChange,
	playSound, removeTooltip, rendez, restartKieg,
	saveLocalDataToCloud, saveSettings, selectTheme, setTooltip,
	sortorol, stopEvent, sugo, switchMobileMode,
	szem4_ADAT_LoadAll, szem4_ADAT_betolt, szem4_ADAT_del, szem4_ADAT_kiir,
	szem4_ADAT_loadNow, szem4_ADAT_restart, szem4_ADAT_saveNow, szem4_EPITO_cscheck,
	szem4_EPITO_csopDelete, szem4_EPITO_infoCell, szem4_EPITO_most, szem4_EPITO_perccsokkento,
	szem4_EPITO_ujCsop, szem4_EPITO_ujFalu, szem4_GYUJTO_search, szem4_farmolo_csoport,
	szem4_farmolo_multiclick, szem4_vije_forgot, szunet, szunetMind,
	updateDefaultProdHour, validate,
});

function stop(){
	var x = setTimeout('',100); for (var i = 0 ; i < x ; i++) clearTimeout(i);
}
stop(); /*Időstop*/
document.getElementsByTagName("html")[0].setAttribute("class","");

function loadXMLDoc(dname) {
	var xhttp;
	if (window.XMLHttpRequest) xhttp=new XMLHttpRequest();
		else xhttp=new ActiveXObject("Microsoft.XMLHTTP");
	xhttp.open("GET",dname,false);
	xhttp.send();
	return xhttp.responseXML;
}

/* Guards against evaluating this script twice against the same page. It used
   to test AZON, but AZON is declared with var further down: once the file
   became IIFE-scoped, hoisting made that typeof always "undefined" and the
   guard stopped firing. A window flag survives a second eval, which is the
   thing actually being guarded against. It is set after the startup block
   below succeeds, so a failed launch can still be retried in the same tab.
   (exit() was never defined anywhere; return is legal here now.) */
if (window.SZEM4_ALREADY_RUNNING) {
	alert("Itt már fut SZEM. \n Ha ez nem igaz, nyitsd meg új lapon a játékot, és próbáld meg ott futtatni");
	return;
}
var VERZIO = 'v4.7 by elbeezy';
var SZEM4_SETTINGS = defaultSettingsState();
var TIME_ZONE = 0;
try{ /*Rendszeradatok*/
	var AZON="S0";
	window.SZEM4_ALREADY_RUNNING = true;
	if (window.name.indexOf(AZON)>-1) AZON="S1";
	var BASE_URL=document.location.href.split("game.php")[0];
	var CONFIG=loadXMLDoc(BASE_URL+"interface.php?func=get_config");

	var SPEED=parseFloat(CONFIG.getElementsByTagName("speed")[0].textContent);
	var UNIT_S=parseFloat(CONFIG.getElementsByTagName("unit_speed")[0].textContent);
	
	var MOBILE_MODE = false;
	var ALL_EXTENSION = [];

	var KTID={}, /*Koord-ID párosok*/
		ID_TO_INFO = {}, /*ID: name: falunév, point: pont, pop: tanya párosok*/
		TERMELES=[5,30,35,41,47,55,64,74,86,100,117,136,158,184,214,249,289,337,391,455,530,616,717,833,969,1127,1311,1525,1774,2063,2400],
		UNITS=["spear","sword","axe","archer","spy","light","marcher","heavy"];
	if (parseFloat(CONFIG.getElementsByTagName("archer")[0].textContent) == 0) {
		let index = UNITS.findIndex(el => el.includes("archer"));
		UNITS.splice(index, 1);
		index = UNITS.findIndex(el => el.includes("marcher"));
		UNITS.splice(index, 1);
	}
	var TEHER = {
		spear: 25,
		sword: 15,
		axe: 10,
		archer: 10,
		spy: 0,
		light: 80,
		marcher: 50,
		heavy: 50
	},
	TANYA = {
		spear: 1,
		sword: 1,
		axe: 1,
		archer: 1,
		spy: 2,
		light: 4,
		marcher: 5,
		heavy: 6
	},
	E_SEB = {
		spear: 18,
		sword: 22,
		axe: 18,
		archer: 18,
		spy: 9,
		light: 10,
		marcher: 10,
		heavy: 11
	};

	var VILL1ST="";
	var MAX_IDO_PERC = 20; // shorttest-be van felülírva!!!
	AZON=game_data.player.id+"_"+game_data.world+AZON;
	/* S0/S1 namespacing exists so two instances can run side by side without
	   overwriting each other's saved data, and the choice is made from
	   window.name a hundred lines above. That means launching the bookmarklet
	   inside a window SZEM itself opened (those are named "<AZON>_Farmolo" and
	   friends, so they contain "S0") silently starts a second instance whose
	   storage is empty -- and every saved farm looks permanently lost.
	   Only warn when the second namespace has nothing in it, so deliberate
	   two-instance use is left alone. */
	if (AZON.slice(-2) === 'S1') {
		var primaryFarms = localStorage.getItem(AZON.slice(0, -1) + '0_farm');
		var ownFarms = localStorage.getItem(AZON + '_farm');
		if (primaryFarms && primaryFarms.length > 200 && (!ownFarms || ownFarms.length < 200)) {
			alert('SZEM m\u00e1sodik p\u00e9ld\u00e1nyk\u00e9nt indul (' + AZON + '), \u00edgy \u00fcres adatokkal kezd.\n\n'
				+ 'A mentett adataid megvannak, csak a m\u00e1sik n\u00e9vt\u00e9rben (' + AZON.slice(0, -1) + '0).\n\n'
				+ 'Ez akkor t\u00f6rt\u00e9nik, ha a bookmarkletet egy olyan ablakban ind\u00edtod, amit kor\u00e1bban maga a SZEM nyitott meg. '
				+ 'Nyiss egy teljesen \u00faj lapot a j\u00e1t\u00e9kkal, \u00e9s onnan ind\u00edtsd -- akkor a r\u00e9gi adataid bet\u00f6lt\u0151dnek.');
		}
	}
	var CLOUD_AUTHS = localStorage.getItem('szem_firebase');
	var USER_ACTIVITY = true;
	var USER_ACTIVITY_TIMEOUT;
	var worker = createWorker(function(self){
		self.TIMERS = {};
		self.addEventListener("message", function(e) {
			if (e.data.id == 'stopTimer') {
				clearTimeout(self.TIMERS[e.data.value]);
			} else {
				self.TIMERS[e.data.id] = setTimeout(() => { postMessage(e.data); }, e.data.time);
			}
		}, false);
	});
	worker.onmessage = function(worker_message) {
		worker_message = worker_message.data;
		switch(worker_message.id) {
			case 'farm': szem4_farmolo_motor(); break;
			case 'vije': szem4_VIJE_motor(); break;
			case 'epit': szem4_EPITO_motor(); break;
			case 'adatok': szem4_ADAT_motor(); break;
			case 'gyujto': szem4_GYUJTO_motor(); break;
			default: debug('worker','Ismeretlen ID', JSON.stringify(worker_message))
		}
	};
	function createWorker(main){
		var blob = new Blob(
			["(" + main.toString() + ")(self)"],
			{type: "text/javascript"}
		);
		return new Worker(window.URL.createObjectURL(blob));
	}
}catch(e){alert('SZEM Nem tud elindulni\n' + e); return;}

function init(){try{
	getServerTime(window, true);
	if (document.getElementById("production_table")) var PFA=document.getElementById("production_table"); else 
	if (document.getElementById("combined_table")) var PFA=document.getElementById("combined_table"); else 
	if (document.getElementById("buildings_table")) var PFA=document.getElementById("buildings_table"); else 
	if (document.getElementById("techs_table")) var PFA=document.getElementById("techs_table");
	else {
		alert("Ilyen nézetbe való futtatás nem támogatott. Kísérlet az áttekintés betöltésére...\n\nLaunching from this view is not supported. Trying to load overview...");
		document.location.href = document.location.href.replace(/screen=[a-zA-Z]+/g,"screen=overview_villages");
		return false;
	}
	if (document.querySelectorAll('#paged_view_content .group-menu-item').length > 0) {
		let isError = false;
		document.querySelectorAll('#paged_view_content .group-menu-item').forEach(e => {
			if (e.href && e.href.includes('group=0')) {
				alert('Ebben a nézetben nem látszódik minden falud, mert csoportra vagy szűrve. SZEM csak azon falukat ismeri ami lát is, így biztosítsd a teljes listát. Kíéslet az átirányításra...');
				document.location.href = e.href;
				isError = true;
			}
		});
		if (isError) return false;
	}
	if (document.querySelectorAll('#paged_view_content .paged-nav-item').length > 0) {
		let isError = false;
		document.querySelectorAll('#paged_view_content .paged-nav-item').forEach(e => {
			if (e.href && e.href.includes('page=-1')) {
				alert('Ebben a nézetben nem látszódik minden falud, mert a lapozhatóság elrejti. SZEM csak azon falukat ismeri ami lát is, így biztosítsd a teljes listát. Kíéslet az átirányításra...');
				document.location.href = e.href;
				isError = true;
			}
		});
		if (isError) return false;
	}

	var faluNevOszlopNo = -1,
		faluPontOszlopNo = -1,
		faluTanyaOszlopNo = -1;
	for (let i=0;i<PFA.rows[0].cells.length;i++) {
		let linkText = PFA.rows[0].cells[i].querySelector('a');
		if (linkText) linkText = linkText.href; else continue;
		if (linkText.includes('order=name')) faluNevOszlopNo=i;
		if (linkText.includes('order=points')) faluPontOszlopNo=i;
		if (linkText.includes('order=pop')) faluTanyaOszlopNo=i;
	}
	if (faluNevOszlopNo == -1) {
		alert("Nem találok koordinátákat ebbe a listába.\n\nI can not find coordinates in this view.");
		return false;
	}
	if (faluPontOszlopNo == -1) {
		alert("Nem találok pontokat ebbe a listába a falukhoz.\n\nI can not find points for villages in this view.");
		return false;
	}
	if (faluTanyaOszlopNo == -1) {
		alert("Nem találok népességmutatót ebbe a listába a falukhoz.\n\nI can not find farm states for villages in this view.");
		return false;
	}

	VILL1ST=PFA.rows[1].cells[faluNevOszlopNo].getElementsByTagName("a")[0].href;
	for (var i=1;i<PFA.rows.length;i++) {
		let kord=PFA.rows[i].cells[faluNevOszlopNo].textContent.match(/[0-9]+(\|)[0-9]+/g);
		kord=kord[kord.length-1];
		let faluId = PFA.rows[i].cells[faluNevOszlopNo].getElementsByTagName("span")[0].getAttribute("data-id").match(/[0-9]+/g)[0] 
		KTID[kord] = faluId;

		let faluNev = PFA.rows[i].cells[faluNevOszlopNo].getElementsByTagName("span")[0].textContent.trim().split(' ');
		faluNev.pop();
		faluNev.pop();

		let faluPont = PFA.rows[i].cells[faluPontOszlopNo].textContent.trim();
		let faluPop = PFA.rows[i].cells[faluTanyaOszlopNo].textContent.trim();
		ID_TO_INFO[faluId] = {
			name: faluNev.join(' '),
			point: faluPont,
			pop: faluPop
		}
	}
	const szemStyle = `
		/* The palette. Every colour below comes from one of these, so the whole
		   interface can be re-tuned from one block instead of hunting hex codes
		   through 400 lines. Near-black surfaces, one accent, used sparingly.

		   The four style boxes on the sound/style panel let a colour be
		   overridden per theme profile, and they write inline styles that beat
		   these. Their default values are therefore the same colours spelled
		   again in HTML attributes -- a test keeps the two copies in step. */
		:root {
			--szem-bg: #0b0d10;
			--szem-surface: #12151a;
			--szem-surface-2: #1a1f26;
			--szem-line: #272e37;
			--szem-text: #dfe4ea;
			--szem-text-dim: #9aa4b0;
			--szem-accent: #d9a441;
			--szem-accent-soft: rgba(217,164,65,0.14);
			--szem-accent-glow: rgba(217,164,65,0.55);
			--szem-hover: rgba(255,255,255,0.06);
			--szem-danger: #e05252;
			--szem-shadow: 0 2px 24px rgba(0,0,0,0.65);

			/* One column, as wide as the window allows up to a comfortable
			   maximum. The header, the panels and the two wallpaper panes beside
			   them are all derived from this, so there is one number to change and
			   nothing can fall out of step with anything else.

			   It used to be a flat 1024px in four places, with the panes worked
			   out as calc(50vw - 512px) -- half of it, spelled again. On a window
			   narrower than 1024 that goes negative, the panes collapse and the
			   interface runs off the side of the screen. */
			--szem-szelesseg: min(1280px, calc(100% - 48px));
		}
		body { background: var(--szem-bg); scrollbar-width: none; padding-bottom: 0; margin: 0; }
		body::-webkit-scrollbar { width: 0; }
		/* Every panel is built carrying width="1024px", the runtime ones from
		   ujkieg() included, so the column width is stated here rather than in
		   markup -- one rule reaches all of them. The full-height rule moved to
		   #content: a panel stretched to the whole window was mostly empty card. */
		#content > table {
			box-shadow: var(--szem-shadow);
			width: 100%;
			box-sizing: border-box;
		}
		#side-notification-container {
			pointer-events: none;
			display: none;
		}
		*[onclick] {
			cursor: pointer;
		}
		#alert2 {
			width: 300px;
			background-color: var(--szem-surface-2);
			color: var(--szem-text);
			border: 1px solid var(--szem-line);
			position: fixed;
			left:40%;
			top:40%;
			font-size: 11pt;
			padding: 5px;
			z-index: 200;
			border-radius: 5px;
			box-shadow: var(--szem-shadow);
			display: none;
			animation: blinkingalert 0.5s infinite;
		}
		@keyframes blinkingalert {
			0% {
				box-shadow: var(--szem-accent-glow) 0 0 0px;
			}
			100% {
				box-shadow: var(--szem-accent-glow) 0 0 20px;
			}
		}
		#alert2head {
			display: flex;
			justify-content: space-between;
			width: 100%;
			cursor: all-scroll;
			background: rgba(255,255,255,0.1);
			margin: -5px;
			padding: 5px;
			font-weight: bold;
			height: 20px;
		}
		#alert2head a {
			padding: 10px 0 10px 10px;
		}
		#kiegs img {
			cursor: pointer;
		}
		#content {
			width: var(--szem-szelesseg);
			margin: auto;
			position: relative;
			z-index: 2;
			min-height: 100vh;
			padding: 20px 0 48px;
		}
		.fej {
			width: var(--szem-szelesseg);
			margin: auto;
			color: var(--szem-text);
			position: relative;
			box-shadow: var(--szem-shadow);
			z-index: 3;
		}
		.fej a {
			color: var(--szem-text);
		}
		.fej > table {
			padding:1px;
			border: 1px solid var(--szem-line);
		}
		#global_notifications {
			position: absolute;
			top: 0;
			left: -22px;
			width: 18px;
		}
		#debugger {
			table-layout: fixed;
			width: 100%;
		}
		#debugger td, #debugger th {
			word-wrap: break-word;
			max-width: 100%;
		}
		#global_notifications img { width: 18px; }
		#global_notifications img.rotate { animation: rotation 2s infinite linear; }
		@keyframes rotation {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}
		table.menuitem {
			vertical-align:top;
			text-align: top;
			padding: 20px;
			margin:auto;
			color: var(--szem-text);
			border: 1px solid var(--szem-line);
		}
		table.menuitem > tbody > tr > td {
			padding: 0px;
			vertical-align:top;
		}
		table td {
			padding: 0px;
			vertical-align:middle;
		}
		table {
			padding: 0px;
			margin: auto;
			color: var(--szem-text);
		}
		/* --- The chrome: the header, the module bar and the panels. ---

		   The header used to be a tiled picture with an empty <h1> sitting on
		   top of it, which is where most of the amateur look came from: the
		   art ran underneath the module bar as well, so the controls sat on
		   whatever colour happened to be behind them. It is type on a surface
		   now, and the bar is its own strip. */
		body, .fej, #content {
			font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			font-size: 13px;
		}
		.fej > table {
			background: var(--szem-surface);
			border-collapse: collapse;
		}
		#fejresz {
			padding: 16px 22px 14px 22px;
		}
		#fejresz h1 {
			margin: 0;
			font-size: 25px;
			font-weight: 300;
			letter-spacing: 0.34em;
			text-transform: uppercase;
			color: var(--szem-text);
			white-space: nowrap;
		}
		/* The one place the accent carries the identity. */
		#fejresz h1 b {
			font-weight: 600;
			color: var(--szem-accent);
		}
		#fejresz h1 i {
			display: block;
			margin-top: 5px;
			font-size: 10px;
			font-style: normal;
			font-weight: 400;
			letter-spacing: 0.22em;
			color: var(--szem-text-dim);
		}
		#sugo {
			padding: 16px 22px;
			vertical-align: middle;
			font-size: 12px;
			line-height: 1.55;
			color: var(--szem-text-dim);
		}
		#menuk {
			background: var(--szem-surface-2);
			border-top: 1px solid var(--szem-line);
		}
		.menubar { padding: 5px 16px; }
		#kiegs a, .menubar_jobb a {
			text-decoration: none;
			color: var(--szem-text-dim);
			font-size: 12px;
			padding: 3px 6px;
			border-radius: 4px;
		}
		#kiegs a:hover, .menubar_jobb a:hover {
			color: var(--szem-text);
			background: var(--szem-hover);
		}
		/* A rule, rather than a pipe character sitting in the text. */
		.menubar_valaszto {
			display: inline-block;
			width: 1px;
			height: 15px;
			margin: 0 5px;
			background: var(--szem-line);
			vertical-align: middle;
		}
		/* Panels read as cards on the page rather than as bordered blocks. */
		table.menuitem {
			background: var(--szem-surface);
			border-radius: 6px;
			padding: 24px 26px;
		}
		table.menuitem > tbody > tr > td > h1,
		table.menuitem h1 {
			margin: 0 0 20px 0;
			font-size: 14px;
			font-weight: 600;
			letter-spacing: 0.17em;
			text-transform: uppercase;
			color: var(--szem-text-dim);
			border-bottom: 1px solid var(--szem-line);
			padding-bottom: 11px;
		}
		/* --- The data tables. ---

		   "vis" is the game's own class, so until now these were whatever the
		   game's stylesheet made them: a light table with black text, dropped
		   into SZEM's dark page. That is why the text was set to black -- it
		   was readable only for as long as the game kept painting a pale
		   background under it, and it was invisible anywhere the game did not.

		   They are stated outright here instead, so a table looks the same
		   whatever the game does around it, and so the preview shows the real
		   thing rather than a lucky accident.

		   Written as "#content table.vis" on purpose: that beats any plain
		   class rule the game may have, while still losing to the colour boxes
		   on the sound panel, whose <style> tags are appended later and carry
		   an id-weighted :not() -- so a colour that was picked still wins. */
		#content table.vis {
			color: var(--szem-text);
			border-collapse: collapse;
			background: transparent;
		}
		#content table.vis th {
			/* Both farm tables hang a search icon and a select-all box in the
			   corner of a header with position:absolute. Without an anchor
			   here that corner is #content's corner, so the control drifts to
			   the top right of the whole panel -- which is where the
			   Szerelvények one had been sitting, its header being the one that
			   was written without the anchor its twin has. */
			position: relative;
			background: var(--szem-surface-2);
			color: var(--szem-text-dim);
			font-size: 11px;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			text-align: left;
			padding: 9px 10px;
			border-bottom: 1px solid var(--szem-line);
			white-space: nowrap;
		}
		#content table.vis td {
			background: transparent;
			color: var(--szem-text);
			padding: 7px 10px;
			border-bottom: 1px solid var(--szem-line);
			/* Columns of numbers line up digit under digit. */
			font-variant-numeric: tabular-nums;
		}
		#content table.vis > tbody > tr:hover > td {
			background: var(--szem-hover);
		}
		#content table.vis th[onclick]:hover {
			color: var(--szem-accent);
		}
		/* The options tables sit on a dark panel now, so black text there was
		   left over from the same assumption. */
		#farmolo_options table {
			color: var(--szem-text);
			text-align: left;
		}
		/* the wagons cell -- no longer last, a distance column follows it */
		#farm_hova > tbody > tr > td:nth-child(6) {
			width: 135px;
		}
		textarea {
			background: var(--szem-surface-2);
			color: var(--szem-text);
			border: 1px solid var(--szem-line);
		}
		.divrow { display: flex; align-items: center; }
		/* The module bar. Its two halves used to carry fixed widths that added up
		   to more than the row they sat in (870 + 250 inside 1016), so every
		   module added past a certain point pushed the last one onto a second
		   line, on top of whatever was below. The left side takes whatever is
		   left over now, and wraps within itself if it ever needs to. */
		.menubar {
			width: 100%;
			align-items: flex-start;
			column-gap: 8px;
			padding: 4px 0;
		}
		#kiegs {
			flex: 1 1 auto;
			min-width: 0;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			column-gap: 4px;
			row-gap: 2px;
			text-align: left;
		}
		.menubar_jobb {
			flex: 0 0 auto;
			display: flex;
			align-items: center;
			column-gap: 6px;
			text-align: right;
		}
		.divcell {
			display: table-cell;
			text-align: center;
			vertical-align:top;
		}
		a { color: var(--szem-text); }
		img{
			border-color: var(--szem-line);
			padding:1px;
		}
		#naploka a { color: var(--szem-accent); }
		input[type="button"] {
			font-size:13px;
			font-family: Century Gothic, sans-serif;
			color: var(--szem-text);
			background: var(--szem-surface-2);
			border: 1px solid var(--szem-line);
		}
		#adat_opts tr td,
		#adat_opts tr th {
			text-align: center;
			vertical-align: middle;
		}
		.profileselector {
			display: flex;
			justify-content: center;
		}
		.profileselector .profile {
			background: var(--szem-surface-2);
			border: 1px solid var(--szem-line);
			color: var(--szem-text);
			padding: 10px;
			margin: 5px;
			cursor: pointer;
		}
		.profileselector .profile:hover {
			border: 1px solid var(--szem-accent);
		}
		.profileselector .profile.active {
			background: var(--szem-accent-soft);
			border: 1px solid var(--szem-accent);
		}
		.szem4_vije_optsTable {
			margin: initial;
			border-collapse: separate;
			border-spacing: 0px 7px;
		}
		.szem4_vije_optsTable input {
			font-size: 10pt;
		}
		#vije_opts input[type="checkbox"] { width: 17px; height: 17px; }

		.tooltip-wrapper { display: flex; flex-wrap: wrap; gap: 10px 0; }
		.tooltip-wrapper img { padding-left: 2px; padding-right: 0; display: table-cell; }
		.tooltip_hover { position: relative; display: table; border-collapse: collapse; }
		.tooltip_text {
			position: absolute; z-index: 1; left: 50%; bottom: 100%; transform: translateX(-50%); white-space: nowrap; font-style: normal; background: var(--szem-surface-2); padding: 5px 8px; border-radius: 3px; margin-bottom: 5px; color: var(--szem-text); display: none; border: 1px solid var(--szem-line);
		}
		.bottom-tooltip .tooltip_text { top: 100%; bottom: auto; }
		.tooltip_text:after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border-top: 5px solid var(--szem-surface-2); border-left: 5px solid transparent; border-right: 5px solid transparent }
		.bottom-tooltip .tooltip_text:after { top: auto; bottom: 100%; border-bottom: 5px solid var(--szem-surface-2); border-top: 5px solid transparent; }
		table.no-bg-table td {
			vertical-align: middle;
			background: transparent;
		}
		table.no-bg-table td .flex_middle {
			display: flex;
			align-items: center;
		}
		.szem4_unitbox {
			display: inline-block;
			position: relative;
			border-radius: 5px;
		}
		.szem4_unitbox label {
			cursor: pointer;
			display: block;
		}
		.szem4_unitbox label:hover {
			background: var(--szem-hover);
		}
		.szem4_unitbox input {
			cursor: pointer;
			margin-left: -2px;
			margin-right: 3px;
		}
		.szem4_farmolo_datatable_wrapper {
			display: flex;
			justify-content: space-between;
		}
		.szem4_farmolo_datatable_wrapper table {
			margin: 0;
		}
		.nopadding_td {
			padding: 0 !important;
		}
		.heartbeat_wrapper {
			height: 18px;
			width: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
		}
		.heartbeat_icon {
			height: 15px;
			padding: 0 2px;
			margin-right: 5px;
			animation: heartbeatanimation 1.0s infinite;
			cursor: pointer
		}
		@keyframes heartbeatanimation {
			0% {
				height: 15px;
				padding: 0 2px;
			}
			33% {
				height: 15px;
				padding: 0 2px;
			}
			50% {
				height: 19px;
				padding: 0;
			}
			66% {
				height: 15px;
				padding: 0 2px;
			}
		}
		#farmolo_options table td,
		#vije_opts table.szem4_vije_optsTable td {
			vertical-align: middle;
		}
		#farmolo_options table td:first-child {
			padding: 0;
		}
		#farmolo_options .combo-cell {
			display: flex;
			align-items: center;
		}
		#farmolo_options .imgbox {
			width: 40px;
			margin-right: 5px;
			text-align: center;
		}
		#farmolo_options .imgbox img {
			height: 24px;
		}
		/* With no wallpaper set these are simply the page either side of the
		   column, which is what makes a neutral default look deliberate
		   rather than empty. */
		.left-background, .right-background {
			background-color: var(--szem-bg);
		}
		.left-background {
			width: calc(50% - var(--szem-szelesseg) / 2);
			height: 100vh;
			position: fixed;
			left: 0;
			top: 0;
			background-repeat: no-repeat;
			background-position-x: right;
			background-size: cover;
		}
		.left-background video,
		.right-background video {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
		.left-background video {
			object-position: right center;
		}
		.left-background.mirrored_bg video {
			object-position: left center;
		}
		.left-background.mirrored_bg {
			background-position-x: left;
		}
		.left-background.mirrored_bg,
		.right-background.mirrored_bg {
			-moz-transform: scale(-1, 1);
			-webkit-transform: scale(-1, 1);
			-o-transform: scale(-1, 1);
			-ms-transform: scale(-1, 1);
			transform: scale(-1, 1);
		}
		.right-background video {
			object-position: left center;
		}
		.right-background.mirrored_bg video {
			object-position: right center;
		}
		.mirrored_bg video::-webkit-media-controls-panel {
			transform: scale(-1,1);
		}
		.right-background {
			width: calc(50% - var(--szem-szelesseg) / 2);
			height: 100vh;
			position: fixed;
			right: 0;
			top: 0;
			background-repeat: no-repeat;
			background-position-x: left;
			background-size: cover;
		}
		.right-background.mirrored_bg {
			background-position-x: right;
		}
		#farm_hova .szem4_farms_overflow {
			display: none;
		}
		.style-settings-table { border-collapse: collapse; }
		.style-settings-table tr { border-bottom: 1px solid var(--szem-line); }
		table.style-settings-table td { padding: 15px 4px; vertical-align: middle; }
		.szem_old_build_tooltip {
			border-left: 3px solid var(--szem-danger);
		}
		.szem_old_build_tooltip i {
			font-weight: bold;
			color: var(--szem-danger);
		}
		.wagon_time {
			position: absolute;
			color: var(--szem-text);
			font-size: 11px;
			top: 5px;
			width: 42px;
			text-align: center;
			text-shadow: 0px 0px 1px black;
		}
		#gyujto_form td:nth-child(4),
		#gyujto_form td:nth-child(5) {
			text-align: center;
		}
		.gyujto_table td:nth-child(2) {
			text-align: center;
		}
	`;
	let szemStyle_el = document.createElement('style');
	szemStyle_el.textContent = szemStyle;
	document.head.appendChild(szemStyle_el);
	document.getElementsByTagName("body")[0].innerHTML=`
		<div class="left-background">
			<video src="" autoplay loop muted></video>
		</div>
		<div class="right-background">
			<video src="" autoplay loop muted></video>
		</div>
		<div id="alert2">
			<div id="alert2head">
				<div>Üzenet</div>
				<div><a href='javascript: alert2("close");'>[ESC] ❌</a></div>
			</div>
			<p id="alert2szov"></p>
		</div>
		<div class="fej">
			<div id="global_notifications"></div>
			<table width="100%" align="center">
				<tr>
					<td width="70%" id="fejresz" style="vertical-align:middle; margin:auto;">
						<h1>Szem <b>IV</b><i>Klánháború</i></h1>
					</td>
					<td id="sugo"></td>
				</tr>
				<tr><td colspan="2" id="menuk" style="">
					<div class="divrow menubar">
						<span class="divcell" id="kiegs">
							<img src="${pic("muhely_logo.png")}" alt="GIT" title="GIT C&amp;C Műhely megnyitása" onclick="window.open('https://github.com/cncDAni2/klanhaboru')">
							<img src="${pic("kh_logo.png")}" alt="Game" title="Klánháború megnyitása" onclick="window.open(document.location.href)">
							<a href="javascript: szunetMind();" id="szunet_mind" title="Minden modul megállítása megadott időre" onmouseover="sugo(this,'Minden futó modult megállít a megadott percre, majd önműködően újraindítja őket.')">Szünet mind</a>
							<span class="menubar_valaszto"></span>
						</span>
						<span class="divcell menubar_jobb">
							<a href=\'javascript: nyit("naplo");\' onmouseover="sugo(this,\'Események naplója\')">Napló</a>
							<a href=\'javascript: nyit("debug");\' onmouseover="sugo(this,\'Hibanapló\')">Debug</a>
							<a href=\'javascript: nyit("hang");\'><img src="${pic("hang.png")}" onmouseover="sugo(this,\'Hangbeállítások\')" alt="hangok"></a>
						</span>
					</div>
				</td></tr>
			</table>
		</div>
		<div id="content"></div>`;
	document.getElementById("content").innerHTML=`
	<table class="menuitem" width="1024px" align="center" id="naplo" style="display: none"><tbody>
	<tr><td>
		<h1 align="center">Napló</h1>
		<br>
		<br>
		<table align="center" class="vis" id="naploka"><tbody>
			<tr>
				<th onclick="\'rendez("datum2",false,this,"naploka",0)\'" style="cursor: pointer;">Dátum</th>
				<th onclick="\'rendez("szoveg",false,this,"naploka",1)\'" style="cursor: pointer;">Script</th>
				<th onclick="\'rendez("szoveg",false,this,"naploka",2)\'" style="cursor: pointer;">Esemény</th>
			</tr>
		</tbody></table>
	</td></tr>
</tbody></table>
<table class="menuitem" width="1024px" align="center" id="debug" style="display: none"><tbody>
	<tr><td>
		<h1 align="center">DeBugger</h1>
		<br>
		<br>
		<button type="button" onclick="debug_urit()">Ürít</button>
		<button type="button" onclick="switchMobileMode()">Mobile_mode</button><br>
		<br>
		<table align="center" class="vis" id="debugger">
		<colgroup>
			<col style="width: 165px;">
			<col style="width: 165px;">
			<col style="width: calc(100% - 330px);">
		</colgroup>
		<tbody>
			<tr>
				<th onclick="rendez('datum2',false,this,'debugger',0)" style="cursor: pointer;">Dátum</th>
				<th onclick="rendez('szoveg',false,this,'debugger',1)" style="cursor: pointer;">Script</th>
				<th onclick="rendez('szoveg',false,this,'debugger',2)" style="cursor: pointer;">Esemény</th>
			</tr>
		</tbody></table>
	</td></tr>
</tbody></table>
<table class="menuitem" width="1024px" align="center" id="hang" style="display: none"><tbody>
	<tr><td><form id="settings">
		<p align="center">
			<audio id="audio1" controls="controls" autoplay="autoplay">
				<source id="wavhang" src="" type="audio/wav">
			</audio>
		</p>
		<h1 align="center">Hangbeállítás</h1>
		<br>
		<div id="hangok" style="display:table;">
			<div style="display:table-row;">
				<div style="display:table-cell; padding:10px;" onmouseover="sugo(this, 'Ha be van kapcsolva, bot védelem esetén ez a link is megnyitódik, mint figyelmeztetés.')">
					<b><input type="checkbox" name="altbot" onchange="saveSettings()"> Alternatív botriadó?
						<br>Megnyitott URL (egyszer)<br>
						<input type="text" id="altbotURL" name="altboturl" size="42" onchange="saveSettings()" value="http://www.youtube.com/watch?v=k2a30--j37Q">
					</b>
				</div>
				<b>
				</b>
			</div>
			<b>
			</b>
		</div>
		<h1 align="center">Háttér- és stílus beállítás</h1>
		<div>
			<div class="profileselector">
				<div class="profile" onclick="selectTheme(1)">Téma 1</div>
				<div class="profile" onclick="selectTheme(2)">Téma 2</div>
				<div class="profile" onclick="selectTheme(3)">Téma 3</div>
				<div class="profile" onclick="selectTheme(4)">Téma 4</div>
			</div>
			<table class="style-settings-table">
			<tr><td>Bal háttérkép</td><td><input type="text" size="80" name="wallp_left" value="-" onchange="onWallpChange()"><br>
										Videó: <input type="text" size="70" name="wallp_left_vid" value="-" onchange="onWallpChange()"><br>
										Tükrözött? <input type="checkbox" onclick="onWallpChange()" name="wallp_left_mirror"></td><td rowspan="2">Videólink. Ha nem szeretnél írj "-" -t, és háttérképet használ. Ha az sincs vagy érvénytelen, akkor háttérszín lesz használva</td></tr>
			<tr><td>Jobb háttérkép</td><td><input type="text" size="80"  name="wallp_right" value="-" onchange="onWallpChange()"><br>
										Videó: <input type="text" size="70" name="wallp_right_vid" value="-" onchange="onWallpChange()"><br>
										Tükrözött? <input type="checkbox" onclick="onWallpChange()" name="wallp_right_mirror"></td></tr>
			<tr><td>Tartalom háttérszíne</td><td><input type="text" size="30" name="content_bgcolor" value="#0b0d10" onchange="onWallpChange()"></td><td>[Default: #0b0d10] Minden CSS "background" property támogatott. <a href="https://www.w3schools.com/cssref/css3_pr_background.php" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Tartalom betűszíne</td><td><input type="text" size="30" name="content_fontcolor" value="#dfe4ea" onchange="onWallpChange()"></td><td>[Default: #dfe4ea] Minden CSS "color" property támogatott. <a href="https://www.w3schools.com/cssref/css_colors_legal.php" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Keret színe</td><td><input type="text" size="30" name="content_border" value="#272e37" onchange="onWallpChange()"></td><td>[Default: #272e37] Valid CSS "border-color" property támogatott. <a href="https://www.w3schools.com/css/css_border_color.asp" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Vetett árnyék</td><td><input type="text" size="30" name="content_shadow" value="0 2px 24px rgba(0,0,0,0.65)" onchange="onWallpChange()"></td><td>[Default: 0 2px 24px rgba(0,0,0,0.65)] Valid CSS "box-shadow" property támogatott. <a href="https://www.w3schools.com/cssref/css3_pr_box-shadow.php" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Beállítás táblázat háttere</td>       <td><input type="text" size="30" name="table_bgcolor"      value="-" onchange="onWallpChange(true, 'table_bgcolor')"></td>     <td>[Default: -] A háttér cellánként értendő. Minden CSS "background" property támogatott. <a href="https://www.w3schools.com/cssref/css3_pr_background.php" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Beállítás táblázat szövegszíne</td>   <td><input type="text" size="30" name="table_color"        value="-" onchange="onWallpChange(true, 'table_color')"></td>       <td>[Default: -] Minden CSS "color" property támogatott. <a href="https://www.w3schools.com/cssref/css_colors_legal.php" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Táblázatok fejlécének háttere</td>    <td><input type="text" size="30" name="table_head_bgcolor" value="-" onchange="onWallpChange(true, 'table_head_bgcolor')"></td><td>[Default: -] A háttér cellánként értendő. Minden CSS "background" property támogatott. <a href="https://www.w3schools.com/cssref/css3_pr_background.php" target="_BLANK">W3School link</a></td></tr>
			<tr><td>Táblázatok fejlécének szövegszíne</td><td><input type="text" size="30" name="table_head_color"   value="-" onchange="onWallpChange(true, 'table_head_color')"></td>  <td>[Default: -] A háttér cellánként értendő. Minden CSS "background" property támogatott. <a href="https://www.w3schools.com/cssref/css3_pr_background.php" target="_BLANK">W3School link</a></td></tr>
		</div></table>
	</form></td></tr>
</tbody></table>`;
	document.title="SZEM IV";
	
	debug("SZEM 4","Verzió: GIT_"+new Date().toLocaleDateString());
	debug("SZEM 4","Prog.azon: "+AZON);
	debug("SZEM 4","W-Speed: "+SPEED);
	debug("SZEM 4","U-Speed: "+UNIT_S);
	return true;
}catch(e){alert("Hiba indításkor:\n\nError at starting:\n"+e); return false;}}

function pic(file){
	return "https://raw.githubusercontent.com/cncDAni2/klanhaboru/main/images/szem4/"+file;
}
function picBuilding(bId) {
	return `<img src="https://dshu.innogamescdn.com/asset/88651122/graphic/buildings/mid/${bId}3.png">`;
}

function selectTheme(themeId) {
	if (themeId == undefined || isNaN(themeId) || themeId < 0 || themeId > 4) themeId = 1;
	SZEM4_SETTINGS.selectedProfile = themeId;
	const themeboxes = document.querySelectorAll('.profileselector .profile');
	themeboxes.forEach((el, i) => {
		if (themeId == i+1) el.classList.add('active'); else el.classList.remove('active');
	});
	SZEM4_SETTINGS = Object.assign(SZEM4_SETTINGS, SZEM4_SETTINGS[`profile${themeId}`]);

	//Load Theme
	const loadObj = SZEM4_SETTINGS[`profile${themeId}`];
	const themeOptions = document.querySelectorAll('#settings .style-settings-table input');
	themeOptions.forEach((inputEl) => {
		if (inputEl.name && loadObj[inputEl.name] !== undefined) {
			if (inputEl.type === 'checkbox') {
				inputEl.checked = loadObj[inputEl.name];
			} else if (inputEl.value) {
				inputEl.value = loadObj[inputEl.name];
			}
		}
	});
	onWallpChange(true, 'ALL');
}

/* A wallpaper pane. "-" is how the rest of the style settings spell "nothing
   here", and the help text next to these boxes already says the background
   colour is used when there is no picture -- so an empty or "-" box clears
   the picture instead of asking the browser for a file named "-". */
function setWallpaper(el, ertek) {
	if (!el) return;
	if (!ertek || ertek === '-') el.style.backgroundImage = '';
	else el.style.backgroundImage = `url('${ertek}')`;
}

function onWallpChange(isUpdate=true, changedText) {
	const settingsForm = document.getElementById('settings');
	for (let i=0;i<settingsForm.length;i++) {
		const el = settingsForm[i];
		if (el.type == 'text' && el.value === '') el.value = '-';
	}

	if (settingsForm.wallp_left_vid.value === '-')
		document.querySelector('.left-background video').style.display = 'none';
	else {
		document.querySelector('.left-background video').style.display = 'inline';
		loadVideoWithRetry(document.querySelector('.left-background video'), settingsForm.wallp_left_vid.value);
	}

	if (settingsForm.wallp_right_vid.value === '-')
		document.querySelector('.right-background video').style.display = 'none';
	else {
		document.querySelector('.right-background video').style.display = 'inline';
		loadVideoWithRetry(document.querySelector('.right-background video'), settingsForm.wallp_right_vid.value);
	}

	// document.querySelector('.left-background video').src = settingsForm.wallp_left_vid.value;
	// document.querySelector('.right-background video').src = settingsForm.wallp_right_vid.value;
	setWallpaper(document.getElementsByClassName('left-background')[0], settingsForm.wallp_left.value);
	setWallpaper(document.getElementsByClassName('right-background')[0], settingsForm.wallp_right.value);
	if (settingsForm.wallp_left_mirror.checked)
		document.querySelector('.left-background').classList.add('mirrored_bg');
	else
		document.querySelector('.left-background').classList.remove('mirrored_bg');
	if (settingsForm.wallp_right_mirror.checked)
		document.querySelector('.right-background').classList.add('mirrored_bg');
	else
		document.querySelector('.right-background').classList.remove('mirrored_bg');

	$('body').css('background',settingsForm.content_bgcolor.value);
	// $('.menuitem').css('background',settingsForm.content_bgcolor.value);
	$('#content').css('background',settingsForm.content_bgcolor.value);
	$('table.menuitem').css('color',settingsForm.content_fontcolor.value);
	$('#content a').css('color',settingsForm.content_fontcolor.value);
	$('table.style-settings-table').css('color',settingsForm.content_fontcolor.value);
	$('table.menuitem').css('border-color', settingsForm.content_border.value);
	$('.fej > table').css('border-color', settingsForm.content_border.value);
	$('#content > table').css('box-shadow', settingsForm.content_shadow.value);
	$('.fej').css('box-shadow', settingsForm.content_shadow.value);
	if (changedText === 'table_bgcolor' || changedText === 'ALL') {
		const styleElement = $("<style>")
			.attr("type", "text/css")
			.html(`.vis:not(#farm_honnan):not(#farm_hova) td { background: ${settingsForm.table_bgcolor.value}; }`);
		$("head").append(styleElement);
	}
	if (changedText === 'table_head_bgcolor' || changedText === 'ALL') {
		const styleElement = $("<style>")
			.attr("type", "text/css")
			.html(`.vis th { background: ${settingsForm.table_head_bgcolor.value} !important; }`);
		$("head").append(styleElement);
	}
	if (changedText === 'table_color' || changedText === 'ALL') {
		const styleElement = $("<style>")
			.attr("type", "text/css")
			.html(`.vis:not(#farm_honnan):not(#farm_hova) td { color: ${settingsForm.table_color.value}; }`);
		$("head").append(styleElement);
	}
	if (changedText === 'table_head_color' || changedText === 'ALL') {
		const styleElement = $("<style>")
			.attr("type", "text/css")
			.html(`.vis th { color: ${settingsForm.table_head_color.value} !important; }`);
		$("head").append(styleElement);
	}
	if (isUpdate) saveSettings();

	function loadVideoWithRetry(videoElement, videoSrc, maxAttempts=5, delayBetweenAttempts=1000) {
		let attempts = 0;
	
		function tryLoadVideo() {
			if (attempts >= maxAttempts) {
				console.error('Max attempts reached. Video not available.');
				return;
			}
		
			videoElement.src = videoSrc;
			attempts++;
		
			// Add an event listener to check for errors
			videoElement.addEventListener('error', function errorHandler() {
				console.error(`Error loading video from ${videoElement.src}`);
				// Retry loading the video after a delay
				setTimeout(tryLoadVideo, delayBetweenAttempts);
				// Remove the event listener to prevent multiple error events
				videoElement.removeEventListener('error', errorHandler);
			});
		
			videoElement.load();
		}
	
		tryLoadVideo();
	}
}

function soundVolume(vol){
	document.getElementById("audio1").volume=vol;
}

/* Turning the volume down is not the same as stopping the clip: it plays on
   silently, and turning the volume back up replays whatever is left of it.
   The element only exists once the interface has been built. */
function stopSound(){
	var el=document.getElementById("audio1");
	if (el) el.pause();
}

function playSound(hang, ext='wav'){try{
	let hang2 = hang;
	if (hang.includes('farmolas')) hang2 ='farmolas';
	var isOn=document.getElementsByName(hang2)[0];
	if (isOn==undefined) {debug("hanghiba","Nem definiált hang: "+hang2); return}
	if (isOn.checked==false) return;
	var play = `https://raw.githubusercontent.com/cncDAni2/klanhaboru/main/images/szem4/${hang}.${ext}`;
	document.getElementById("wavhang").src=play;
	document.getElementById("audio1").load();
	document.getElementById("audio1").play();
	//setTimeout(function() { if (document.getElementById("audio1").paused) document.getElementById("audio1").play()}, 500);
}catch(e){alert2(e);}}

function validate(evt) {
	var theEvent = evt || window.event;
	var key = theEvent.keyCode || theEvent.which;
	key = String.fromCharCode( key );
	var regex = /[0-9]|\./;
	if( !regex.test(key) ) {
		theEvent.returnValue = false;
		if(theEvent.preventDefault) theEvent.preventDefault();
	}
}

function shorttest() {
	try {
		var hiba = ''; var warn = '';
		let optsForm = document.getElementById('farmolo_options');

		if (optsForm.termeles.value == '') hiba += 'Termelés/óra értéke üres. Legalább egy 0 szerepeljen!\n';
		if (parseInt(optsForm.termeles.value, 10) < 50) warn += "Termelés/óra értéke nagyon alacsony. Min 50\n";

		if (optsForm.maxtav_ora.value == '') hiba += 'Max táv/óra: Üres érték. \n';
		if (optsForm.maxtav_p.value == '') hiba += 'Max táv/perc: Üres érték. \n';
		if (parseInt(optsForm.maxtav_ora.value, 10) == 0 && parseInt(optsForm.maxtav_p.value, 10) < 1) hiba += 'A jelenleg megadott max távolság 0!\n';
		if (parseInt(optsForm.maxtav_ora.value, 10) == 0 && parseInt(optsForm.maxtav_p.value, 10) < 40) warn += 'A jelenleg megadott max távolság nagyon rövid!\n';

		if (optsForm.kemdb.value == '') hiba += 'Ha nem szeretnél kémet küldeni, írj be 0-t.\n';
		if (parseInt(optsForm.kemdb.value, 10) > 3) warn += '3-nál több kém egyik szerveren sem szükséges. Javasolt: 1 vagy 3.\n';
		if (optsForm.isforced.checked && parseInt(optsForm.kemdb.value, 10) == 0) warn += 'Kényszeríted a kémek küldését, de a küldendő kém értékére 0 van megadva!\n';

		if (optsForm.kemperc.value == '') hiba += 'Kém/perc üres. Ha mindig küldenél kémet, legyen 0, bár ilyenre semmi szükség';

		if (optsForm.minsereg.value == '') hiba += 'Ha minimum limit nélkül szeretnéd egységeid küldeni, írj be 0-t.\n';

		if (optsForm.sebesseg_p.value == '') hiba += 'A legkevesebb pihenő idő: 1 perc, ne hagyd üresen.\n';
		if (parseInt(optsForm.sebesseg_p.value, 10) < 1) hiba += 'A legkevesebb pihenő idő: 1 perc.\n';
		if (parseInt(optsForm.sebesseg_p.value, 10) > 30) warn += '30 percnél több pihenő időt adtál meg. Biztos?\n';
		if (parseInt(optsForm.sebesseg_p.value, 10) > 150) hiba += '150 percnél több pihenő időt nem lehet megadni.\n';
		if (optsForm.sebesseg_m.value == '') hiba += 'A leggyorsabb ciklusidő: 200 ms, ne hagyd üresen.\n';
		if (parseInt(optsForm.sebesseg_m.value, 10) < 200) hiba += 'A leggyorsabb ciklusidő: 200 ms\n';
		if (parseInt(optsForm.sebesseg_m.value, 10) > 5000) hiba += '5000 ms-nél több ciklusidő felesleges, és feltűnő. Írj be 5000 alatti értéket.\n';

		if (optsForm.raktar.value == '' || parseInt(optsForm.raktar.value, 10) < 20) hiba += 'Raktár telítettségi értéke túl alacsony, így vélhetőleg sehonnan se fog fosztani. Min 20%';

		if (optsForm.megbizhatosag.value == '' || parseInt(optsForm.megbizhatosag.value, 10) < 5 || parseInt(optsForm.megbizhatosag.value, 10) > 180) hiba += 'Megbízhatósági szint 5-180 perc között legyen';
		// inkább hogy az első szám legyen kisebb mint a megb.
		else MAX_IDO_PERC = parseInt(optsForm.megbizhatosag.value, 10);

		if (hiba != '' && !FARM_PAUSE) document.querySelector('#kiegs img[name="farm"]').click();
		if (hiba != '') {
			alert2('<b>Egy vagy több beállítási hiba miatt nem indítható a farmoló!</b><br><br>' + hiba);
			return false;
		} else {
			if (warn == '')
				alert2('close');
			else
				alert2('Javaslatok:\n' + warn);
		}
		for (const el of optsForm) {
			if (!el.name) continue;
			if (el.type == 'checkbox') {
				SZEM4_FARM.OPTIONS[el.name] = el.checked;
			} else {
				if (isNaN(el.value)) {
					SZEM4_FARM.OPTIONS[el.name] = el.value;
				} else {
					SZEM4_FARM.OPTIONS[el.name] = parseInt(el.value, 10);
				}
			}
		}
		return true;
	} catch (e) { alert2('Hiba validáláskor:\n' + e); }
}

var SUGOORA;
function sugo(el, str) {
	if (str == '') {
		document.getElementById("sugo").innerHTML=str;
		return;
	}
	if (!el.hasAttribute("data-hossz")) {
		el.addEventListener("mouseout", (event) => {
			SUGOORA = setTimeout(() => sugo(event.fromElement, ""), parseInt(event.fromElement.getAttribute('data-hossz'), 10));
		});
	}
	var hossz=str.length;
	hossz=Math.round((hossz*1000)/40);
	if (SUGOORA!="undefined") clearTimeout(SUGOORA);
	document.getElementById("sugo").innerHTML=str;
	el.setAttribute('data-hossz', hossz);
}

function prettyDatePrint(m) {
	return m.getFullYear() + "/" +
	("0" + (m.getMonth()+1)).slice(-2) + "/" +
	("0" + m.getDate()).slice(-2) + " " +
	("0" + m.getHours()).slice(-2) + ":" +
	("0" + m.getMinutes()).slice(-2) + ":" +
	("0" + m.getSeconds()).slice(-2);
}
function nyit(ezt){try{
	var temp=document.getElementById("content").childNodes;
	var cid="";
	for (var i=0;i<temp.length;i++) {
		if (temp[i].nodeName.toUpperCase()=="TABLE") {cid=temp[i].getAttribute("id");
		$("#"+cid).fadeOut(300);}
	} var patt=new RegExp("\""+ezt+"\"");
	temp=document.getElementById("menuk").getElementsByTagName("a");
	for (i=0;i<temp.length;i++) {
		temp[i].style.padding="3px";
		if (patt.test(temp[i].getAttribute("href"))) temp[i].style.backgroundColor="#000000"; else temp[i].style.backgroundColor="transparent";
	}
	setTimeout(function(){$("#"+ezt).fadeIn(300)},300);
	//addFlyingOptions(ezt);
}catch(e){alert(e);}}

function alert2(szov){
	szov=szov+"";
	if (szov=="close") {$("#alert2").hide(); return;}
	szov=szov.replace("\n","<br>");
	document.getElementById("alert2szov").innerHTML=szov;
	$("#alert2").show();
}

function naplo(script,szoveg){
	var d=new Date();
	var perc=d.getMinutes(); var mp=d.getSeconds(); if (perc<10) perc="0"+perc; if (mp<10) mp="0"+mp;
	var honap=new Array("Jan","Febr","March","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec");
	var table=document.getElementById("naploka");
	var row=table.insertRow(1);
	var cell1=row.insertCell(0);
	var cell2=row.insertCell(1);
	var cell3=row.insertCell(2);
	cell1.innerHTML=honap[d.getMonth()]+" "+d.getDate()+", "+d.getHours()+":"+perc+":"+mp;
	cell2.innerHTML=script;
	cell3.innerHTML=szoveg;
	playSound("naplobejegyzes");
	return;
}
function debug(script,szoveg) {
	let d = new Date();
	var table=document.getElementById("debugger");
	var row=table.insertRow(1);
	var cell1=row.insertCell(0);
	var cell2=row.insertCell(1);
	var cell3=row.insertCell(2);
	cell1.innerHTML=d.toLocaleString();
	cell2.innerHTML=script;
	cell3.innerHTML=szoveg;
	if (table.rows.length > 300) {
		$("#debugger").find('tr:gt(150)').remove();
	}
	if (table.rows.length > 10 && d - new Date(`${table.rows[10].cells[0].textContent}`) < 180000) {
		let errorCount = 0;
		for (var i = 1; i < 11; i++) {
			let cellText = table.rows[i].cells[2].textContent;
			if (cellText.toLowerCase().includes("error")) {
				errorCount++;
			}
		}
		if (errorCount > 4) {
			naplo('Auto-error', 'Túl sok hiba valahol?');
			playSound('kritikus_hiba');
		}
	}
}
function debug_urit() {
	$("#debugger").find('tr:gt(0)').remove();
}

function ujkieg(id,nev,tartalom){
	if (document.getElementById(nev)) return false;
	ALL_EXTENSION.push(id);
	/* The icon reflects current state, not the action, so a module that starts
	   paused shows the pause image. Keep this in step with the *_PAUSE initial
	   values further down. */
	const startsPaused = ['farm', 'vije', 'gyujto', 'epit'];
	document.getElementById("kiegs").innerHTML+='<img onclick=\'szunet("'+id+'",this)\' name="'+id+'" onmouseover=\'sugo(this,"Az érintett scriptet tudod megállítani/elindítani.")\' src="'+pic((startsPaused.includes(id)?'pause':'play')+ ".png")+'" alt="Stop" title="Klikk a szüneteltetéshez"> <a href=\'javascript: nyit("'+id+'");\'>'+nev.toUpperCase()+'</a> ';
	document.getElementById("content").innerHTML+='<table class="menuitem" width="1024px" align="center" id="'+id+'" style="display: none">'+tartalom+'</table>';
	return true;
}
function ujkieg_hang(nev,hangok){
	try{var files=hangok.split(";");}catch(e){var files=hangok;}
	var hely=document.getElementById("hangok").getElementsByTagName("div")[0];
	var kieg=document.createElement("div"); kieg.setAttribute("style","display:table-cell; padding:10px;");
	var str="<h3>"+nev+"</h3>";
	for (var i=0;i<files.length;i++) {
		str+=`<input type="checkbox" name="${files[i]}" checked onchange="saveSettings()"> <a href="javascript: playSound('${files[i]}');"> ${files[i]} </a><br>`;
	}
	kieg.innerHTML=str;
	hely.appendChild(kieg);
	return;
}

/* Pausing a module means two things that have to stay in step: its own flag,
   and the icon that reports it. Both live here now, so that everything wanting
   to stop or start a module -- the icons, and the global pause -- goes through
   one place and gets the same side effects. "idtamad" has no flag of its own:
   it only listens for incoming attacks, so there is nothing to pause. */
function moduleIsPaused(script) {
	switch (script) {
		case "farm":   return FARM_PAUSE;
		case "vije":   return VIJE_PAUSE;
		case "epit":   return EPIT_PAUSE;
		case "adatok": return ADAT_PAUSE;
		case "gyujto": return GYUJTO_PAUSE;
		default:       return null;
	}
}

function setModulePause(script, paused, kep) {
	switch (script) {
		case "farm":   FARM_PAUSE   = paused; break;
		case "vije":   VIJE_PAUSE   = paused; break;
		case "epit":   EPIT_PAUSE   = paused; break;
		case "adatok": ADAT_PAUSE   = paused; break;
		case "gyujto": GYUJTO_PAUSE = paused; break;
		default: return false;
	}

	/* From the icon's own handler the element arrives as an argument; called
	   programmatically it has to be looked up by name. */
	if (!kep) kep = document.querySelector('#kiegs img[name="' + script + '"]');
	if (kep) {
		kep.src   = pic(paused ? "pause.png" : "play.png");
		kep.alt   = paused ? "Start" : "Stop";
		kep.title = paused ? "Klikk a folytatáshoz" : "Klikk a szüneteltetéshez";
	}

	if (script == "farm") shorttest();
	/* Starting VIJE by hand beats a synced rest -- otherwise the play icon would
	   claim it is running while it sits out the rest of the farm's break. */
	if (script == "vije" && !paused) VIJE_SYNC_REST_UNTIL = 0;
	return true;
}

function szunet(script,kep){try{
	if (script == "idtamad") {
		alert2("Ezt a script nem állítható meg, mivel nem igényel semmilyen erőforrást.<br>Ha a hangot szeretnéd kikapcsolni, megteheted azt a hangbeállításoknál.");
		return;
	}
	var most = moduleIsPaused(script);
	if (most === null) { alert2("Sikertelen script megállatás. Nincs ilyen alscript: " + script); return; }
	setModulePause(script, !most, kep);
}catch(e){alert2("Hiba:\n"+e);}}

/* Stopping SZEM to step away means clicking every module in turn, and coming
   back means remembering which ones had been running. This does both: it
   records what is running now, stops exactly those, and starts exactly those
   again when the time is up. A module stopped by hand beforehand stays
   stopped, and one started by hand during the pause is simply left running.

   Two modules are deliberately left out. "idtamad" has no pause of its own --
   it only listens for incoming attacks and costs nothing. "adatok" only writes
   backups, and stopping the backups while nobody is watching is the opposite
   of what a pause is for.

   The deadline is held as a timestamp rather than counted down, so a timer the
   browser delays in a background tab resumes at the right moment rather than
   drifting later and later. Nothing is stored: every module starts paused
   after a reload anyway, so a pause cannot outlive the page it was set on. */
var SZUNET_MIND_VEGE = 0, SZUNET_MIND_VISSZA = [], SZUNET_MIND_TIMER = 0;
var SZUNET_MIND_KIVETEL = ['idtamad', 'adatok'];
var SZUNET_MIND_MAX_PERC = 1440;

function szunetMindHatralevo() {
	return Math.max(SZUNET_MIND_VEGE - Date.now(), 0);
}

function szunetMindFelirat() {
	var el = document.getElementById('szunet_mind');
	if (!el) return;
	if (!SZUNET_MIND_VEGE) {
		el.textContent = 'Szünet mind';
		el.title = 'Minden modul megállítása megadott időre';
		return;
	}
	var mp = Math.ceil(szunetMindHatralevo() / 1000);
	el.textContent = 'Szünet ' + Math.floor(mp / 60) + ':' + String(mp % 60).padStart(2, '0');
	el.title = 'Kattints a folytatáshoz most';
}

function szunetMindFut(id) {
	return !SZUNET_MIND_KIVETEL.includes(id) && moduleIsPaused(id) === false;
}

function szunetMindInditas(perc) {
	SZUNET_MIND_VISSZA = ALL_EXTENSION.filter(szunetMindFut);
	SZUNET_MIND_VEGE = Date.now() + perc * 60000;
	SZUNET_MIND_VISSZA.forEach(function (id) { setModulePause(id, true); });
	if (SZUNET_MIND_TIMER) clearInterval(SZUNET_MIND_TIMER);
	SZUNET_MIND_TIMER = setInterval(szunetMindOra, 1000);
	szunetMindFelirat();
	naplo('Szünet', 'Minden modul megállítva ' + perc + ' percre. Újraindul: ' + SZUNET_MIND_VISSZA.join(', ') + '.');
	return true;
}

function szunetMindVege(kezi) {
	if (SZUNET_MIND_TIMER) { clearInterval(SZUNET_MIND_TIMER); SZUNET_MIND_TIMER = 0; }
	SZUNET_MIND_VEGE = 0;
	var vissza = SZUNET_MIND_VISSZA;
	SZUNET_MIND_VISSZA = [];
	/* Setting rather than toggling, so a module already restarted by hand
	   during the pause is left alone instead of being stopped again. */
	vissza.forEach(function (id) { setModulePause(id, false); });
	szunetMindFelirat();
	naplo('Szünet', (kezi ? 'Kézzel folytatva' : 'Letelt a szünet') + ', újraindítva: ' + (vissza.join(', ') || 'semmi') + '.');
	return vissza;
}

function szunetMindOra() {
	if (szunetMindHatralevo() > 0) { szunetMindFelirat(); return; }
	szunetMindVege(false);
}

function szunetMind() {try{
	if (SZUNET_MIND_VEGE) {
		var mp = Math.ceil(szunetMindHatralevo() / 60000);
		if (confirm('Még ' + mp + ' perc van hátra. Folytatod most a modulokat?')) szunetMindVege(true);
		return;
	}
	var fut = ALL_EXTENSION.filter(szunetMindFut);
	if (!fut.length) {
		alert2('Jelenleg egyetlen modul se fut, nincs mit megállítani.');
		return;
	}
	var valasz = prompt('Hány percre álljon meg minden futó modul?\n\nMegállítja: ' + fut.join(', ') + '\nUtána önműködően újraindulnak.\n\nA bejövő támadások figyelése és az adatmentés tovább fut.', '30');
	if (valasz === null) return;
	var perc = parseInt(valasz, 10);
	if (!(perc > 0)) { alert2('Adj meg egy 0-nál nagyobb egész számot percben.'); return; }
	if (perc > SZUNET_MIND_MAX_PERC) { alert2('Legfeljebb ' + SZUNET_MIND_MAX_PERC + ' perc adható meg.'); return; }
	szunetMindInditas(perc);
}catch(e){debug('szunetMind', e); alert2('Hiba:\n'+e);}}

function distCalc(S,D){
	S[0]=parseInt(S[0]);
	S[1]=parseInt(S[1]);
	D[0]=parseInt(D[0]);
	D[1]=parseInt(D[1]);
	return Math.abs(Math.sqrt(Math.pow(S[0]-D[0],2)+Math.pow(S[1]-D[1],2)));
}

function rendez(tipus, isAsc, thislink, table_azon, oszlopNo){try{
    /*Tipus: "szoveg" v "szam" */
	var OBJ=document.getElementById(table_azon);
	var prodtable=document.getElementById(table_azon).rows;
	if (prodtable.length<2) return;
	var tavok=new Array(); var sorok=new Array(); var indexek=new Array();
	for (var i=1;i<prodtable.length;i++) {
		let cellText = prodtable[i].cells[oszlopNo].textContent.trim();
		switch (tipus) {
			case "szoveg": tavok[i-1]=cellText; break;
			case "szam":
				let tc = cellText;
				if (!tc || tc == '')
					tavok[i-1] = -0.1;
				else
					tavok[i-1]=parseInt(tc.replace(".",""));
				break;
			/* Distances are small and fractional, so the thousands-separator
			   strip that "szam" does would turn 4.2 fields into 42. */
			case "tav": tavok[i-1] = (!cellText || cellText == '') ? -0.1 : parseFloat(cellText); break;
			case "datum": if (cellText == '' || cellText == '---') tavok[i-1]=getServerTime(); else tavok[i-1]=new Date(cellText); break;
			case "datum2": var honap=new Array("Jan","Febr","March","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec");
				var d=new Date();
				var s=cellText;
				d.setMonth(honap.indexOf(s.split(" ")[0]));
				d.setDate(s.split(" ")[1].replace(",",""));
				d.setHours(s.split(" ")[2].split(":")[0]);
				d.setMinutes(s.split(" ")[2].split(":")[1]);
				d.setSeconds(s.split(" ")[2].split(":")[2]);
				tavok[i-1]=d; break;
			case "lista":    tavok[i-1] = prodtable[i].cells[oszlopNo].getElementsByTagName("select")[0].value; break;
			case "checkbox": tavok[i-1] = prodtable[i].cells[oszlopNo].querySelector('input[type="checkbox"]').checked?1:0; break;
			case "tanya": tavok[i-1]=parseInt(cellText.split('/')[0]); break;
			default: throw("Nem értelmezhető mi szerint kéne rendezni.");
		}
		sorok[i-1]=prodtable[i];
		indexek[i-1]=i-1;
	}
	
	for (var i=0;i<tavok.length;i++) {
		var min=i;
		for (var j=i;j<tavok.length;j++) {
			if (isAsc) {if (tavok[j]>tavok[min]) min=j;}
			else {if (tavok[j]<tavok[min]) min=j;}
		}
		var Ttemp=tavok[i];
		tavok[i]=tavok[min];
		tavok[min]=Ttemp;
		
		var Ttemp=indexek[i];
		indexek[i]=indexek[min];
		indexek[min]=Ttemp;
	}
	
	for (var i=prodtable.length-1;i>0;i--) {
		OBJ.deleteRow(i);
	}
	
	/* Back into the tbody, not onto the table. appendChild on a <table> puts
	   the row after the tbody rather than inside it, so every rule written as
	   "#farm_hova > tbody > tr > td" stops matching -- which is how sorting the
	   farm list collapsed the Szerelvenyek column, whose width is one of them.
	   Re-appending into the tbody also repairs a table an earlier sort broke. */
	var torzs = OBJ.tBodies[0] || OBJ;
	for (var i=0;i<tavok.length;i++) {
		torzs.appendChild(sorok[indexek[i]]);
	}
	
	thislink.setAttribute("onclick","rendez(\""+tipus+"\","+!isAsc+",this,\""+table_azon+"\","+oszlopNo+")");
	hideFarms();
	return;
}catch(e){alert2("Hiba rendezéskor:\n"+e);}}

function rovidit(tipus) {
	var ret="";
	switch (tipus) {
		case "egysegek": 
			for (var i=0;i<UNITS.length;i++)
			ret+=`<div class="szem4_unitbox" data-allunit="999" name="${UNITS[i]}"><label>
				<img src="/graphic/unit/unit_${UNITS[i]}.png">
				<input type="checkbox" name="${UNITS[i]}" onclick="szem4_farmolo_multiclick(${i},'honnan',this.checked)">
				</label></div>`;
			break;
		default: ret="";
	}
	return ret;
}

function getServerTime(ref, isSilent=false) {
	if (ref) {
		if (ref.document.getElementById('serverTime') && ref.document.getElementById('serverDate')) {
			let currentDate = convertDateString(ref.document.getElementById('serverTime').textContent, ref.document.getElementById('serverDate').textContent);
			let newDate = new Date();
			let diff = currentDate - newDate;
			if (Math.abs(diff / 60000) > 2) {
				let newZone = Math.round(diff / 900000) * 15;
				if (TIME_ZONE != newZone && !isSilent) naplo('Időzóna 🕐', `Időeltolódás frissítve: eltolódás ${TIME_ZONE} perccel.`);
				TIME_ZONE = newZone;
			}
		} else {
			if (!isSilent) naplo('Időzóna 🕐', `Nem megállapítható időzóna (betöltetlen lap?), frissítés sikertelen.`);
		}
	}
	let newDate = new Date();
	newDate.setMinutes(newDate.getMinutes() + TIME_ZONE);
	return newDate;

	function convertDateString(timeString, dateString) {
		let dateParts = dateString.split("/");
		let newDate = dateParts[1] + "/" + dateParts[0] + "/" + dateParts[2];
		return new Date(newDate + " " + timeString);
	}
}

function maplink(koord){
	return '<a href="'+gameUrl({ screen: 'map', x: koord.split('|')[0], y: koord.split('|')[1], mode: null, group: null, page: null })+'" target="_BLANK">'+koord+'</a>';
}
/*dupla klikk események*/
function multipricer(ez,tip,s1){try{
	if (ez==undefined) return;
	if (!(document.getElementById("farm_multi_"+ez).checked)) return;
	var x=document.getElementById("farm_"+ez).rows;
	for (var i=x.length-1;i>0;i--) {
		if (x[i].style.display!="none") {
			let koord = x[i].closest('tr').cells[0].textContent;
			SZEM4_FARM.DOMINFO_FARMS[koord].szin = SZEM4_FARM.DOMINFO_FARMS[koord].szin || {};
			switch(tip) {
				case "del": delete SZEM4_FARM.DOMINFO_FARMS[koord]; x[i].parentNode.removeChild(x[i]); break;
				case "urit": x[i].cells[2].innerHTML=""; break;
				case "mod": SZEM4_FARM.DOMINFO_FARMS[koord].nyers = parseInt(s1, 10); x[i].cells[3].innerHTML=s1; break;
				case "htor":
					SZEM4_FARM.DOMINFO_FARMS[koord].szin.falu = '';
					x[i].cells[0].style.backgroundColor="#f4e4bc";
					break;
				case 'hreset':
					SZEM4_FARM.DOMINFO_FARMS[koord].szin.fal = '';
					SZEM4_FARM.DOMINFO_FARMS[koord].szin.marks = '';
					x[i].cells[2].style.backgroundColor = s1;
					x[i].cells[2].style.border = '';
					break;
				case "hcser": 
					SZEM4_FARM.DOMINFO_FARMS[koord].szin.fal = s1;
					x[i].cells[2].style.backgroundColor=s1;
					break;
				case 'addmark':
					SZEM4_FARM.DOMINFO_FARMS[koord].szin.marks = s1;
					x[i].cells[2].style.border = `2px solid ${s1}`;
					break;
			}
		}
	}
}catch(e){ console.error(e); }}

function sortorol(cella,ismulti) {
	var row = cella.parentNode;
	delete SZEM4_FARM.DOMINFO_FARMS[row.cells[0].textContent];
	delete SZEM4_FARM.DOMINFO_FROM[row.cells[0].textContent];
	row.parentNode.removeChild(row);
	refreshFarmDistances(); // the row removed may have been an attacking village
	multipricer(ismulti, "del");
}
function modosit_szam(cella){
	var uj=prompt('Új érték?');
	if (uj==null) return;
	uj=uj.replace(/[^0-9]/g,"");
	if (uj=="") return;
	uj = parseInt(uj, 10);
	cella.innerHTML=uj;
	SZEM4_FARM.DOMINFO_FARMS[cella.closest('tr').cells[0].textContent].nyers = uj;
	multipricer("hova","mod",uj);
}
function hattertolor(cella) {
	cella.style.backgroundColor="#f4e4bc";
	let koord = cella.closest('tr').cells[0].textContent;
	SZEM4_FARM.DOMINFO_FARMS[koord].szin = SZEM4_FARM.DOMINFO_FARMS[koord].szin || {};
	SZEM4_FARM.DOMINFO_FARMS[koord].szin.falu = '';
	multipricer("hova","htor");
}
function hattercsere(cella){
	var szin = "#00FF00";
	let koord = cella.closest('tr').cells[0].textContent;
	SZEM4_FARM.DOMINFO_FARMS[koord].szin = SZEM4_FARM.DOMINFO_FARMS[koord].szin || {};

	if (cella.style.backgroundColor=="rgb(0, 255, 0)" || cella.style.backgroundColor=="#00FF00") {
		if (cella.style.border) {
			szin="#f4e4bc";
			cella.style.backgroundColor = szin;
			SZEM4_FARM.DOMINFO_FARMS[koord].szin.fal = '';
			cella.style.border = '';
			SZEM4_FARM.DOMINFO_FARMS[koord].szin.marks = '';
			multipricer("hova","hreset",szin);
		} else {
			szin='blue';
			cella.style.border = `2px solid ${szin}`;
			SZEM4_FARM.DOMINFO_FARMS[koord].szin.marks = szin;
			multipricer("hova","addmark",szin);
		}
	} else {
		cella.style.backgroundColor = szin;
		SZEM4_FARM.DOMINFO_FARMS[koord].szin.fal = szin;
		multipricer("hova","hcser",szin);
	}
	
}
function addFreezeNotification() {
	if (!USER_ACTIVITY) document.getElementById('global_notifications').innerHTML = `<img src="${pic('freeze.png')}" class="rotate" onmouseover="sugo(this,'Amíg SZEM keretrendszert piszkálod, SZEM pihen hogy fókuszálni tudj (automata)')">`;
	USER_ACTIVITY = true;
	clearTimeout(USER_ACTIVITY_TIMEOUT);
	USER_ACTIVITY_TIMEOUT = setTimeout(() => {
		USER_ACTIVITY = false;
		document.getElementById('global_notifications').innerHTML = '';
	}, 5000);
}
function stopEvent(ev) {
	ev.stopImmediatePropagation();
}

/* An unanswered check used to leave SZEM sounding an alarm and holding a
   window open for as long as it took someone to come back. After this long it
   stands down instead: the noise stops and the window closes.

   Standing down is not the same as carrying on. BOT stays true and every
   module stays halted, because the check is still there and still unanswered
   -- only the alarm gives up, never the halt it exists to enforce. */
var BOT_HATARIDO_MS = 180000;
/* One fixed level, not a climb. The alarm can end up ringing in an empty
   flat, so it must never get louder than whatever was set here; if nobody
   answers it, BOT_HATARIDO_MS silences it entirely. 0.0 - 1.0. */
var BOT_HANGERO = 0.5;
var BOT_KEZDET = 0, BOT_FELADVA = false;
/* Checking a claim that the check has been solved, rather than waiting for
   one to be. He is at the keyboard when this runs, so it stays silent and
   gives up in seconds -- long enough for the page to come back, not so long
   that he is left staring at nothing. */
var BOT_ELLENORZES = false, BOT_ELLENORZES_KEZDET = 0;
var BOT_ELLENORZES_MS = 20000;
var BOTORA = 0, ALTBOT2=false; /*ALTBOT2 --> megnyílt e már 1x az ablak*/
var BOT_REF;
/* The windows SZEM opens for its modules, as a list of the ones still open.

   BotvedelemKi() used to find these by walking `window` for property names
   containing "REF". That worked while the script was a pile of globals; the
   day it was wrapped in an IIFE they became locals, the walk started finding
   nothing, and the refresh after a check quietly stopped happening. Naming
   them is duller and cannot silently become a no-op again. */
function nyitottAblakok() {
	var lista = [['FARM_REF', FARM_REF], ['VIJE_REF1', VIJE_REF1], ['VIJE_REF2', VIJE_REF2],
	             ['EPIT_REF', EPIT_REF], ['GYUJTO_REF', GYUJTO_REF], ['BOT_REF', BOT_REF]];
	var nyitva = [];
	for (var i = 0; i < lista.length; i++) {
		/* Reading .closed throws on a window that has gone away underneath us. */
		try { if (lista[i][1] && !lista[i][1].closed) nyitva.push({ nev: lista[i][0], ablak: lista[i][1] }); }
		catch (e) { debug('nyitottAblakok', lista[i][0] + ': ' + e); }
	}
	return nyitva;
}
/* The one place that decides whether a page is showing a bot check, so that
   raising the alarm and deciding it has cleared can never disagree. Returns
   the signal that fired, for the log, or '' for a clean page.

   The three ids are what the game itself uses and are the same on every
   server. The page title is only a fallback: comparing it for equality with
   the Hungarian wording meant it contributed nothing anywhere else. It is
   matched as a whole word at the start of the title instead, so a village
   called Botond cannot trip it -- a false alarm halts every module, so this
   fallback has to stay narrow. */
function botvedelemJel(doc) {
	try {
		if (doc.getElementById('botprotection_quest')) return 'botprotection_quest';
		if (doc.getElementById('bot_check')) return 'bot_check';
		if (doc.getElementById('popup_box_bot_protection')) return 'popup_box_bot_protection';
		if (/^bot\b/i.test(doc.title || '')) return 'c\u00edm: ' + doc.title;
	} catch (e) { debug('botvedelemJel', e); } // cross-origin, or a window closing mid-read
	return '';
}
/* How often the open windows are swept for a check.

   Until now a check was only ever noticed inside isPageLoaded(), which runs
   when a module happens to poll a page. A window nothing is currently
   driving -- one whose module is between steps, or waiting out a rest --
   could sit on a check for as long as it took something else to trip over
   it. Ten seconds is cheap: a handful of getElementById calls. */
var BOT_FIGYELO_MS = 10000;
var BOT_FIGYELO = 0;

function botvedelemFigyeloIndit() {
	if (BOT_FIGYELO) return;
	BOT_FIGYELO = setInterval(botvedelemFigyelo, BOT_FIGYELO_MS);
}

function botvedelemFigyelo() {
	/* Already ringing: the alarm has its own cycle watching BOT_REF. */
	if (BOT) return;
	/* Nothing running means nothing to interrupt. The alarm exists to stop
	   work in its tracks, and waking the flat for a check that is in nobody's
	   way -- during a Sz\u00fcnet mind, say -- is the wrong trade. */
	if (!ALL_EXTENSION.some(szunetMindFut)) return;
	var ablakok = nyitottAblakok();
	for (var i = 0; i < ablakok.length; i++) {
		var doc;
		/* Reaching for .document throws on a window closing under us. */
		try { doc = ablakok[i].ablak.document; }
		catch (e) { debug('botvedelemFigyelo', ablakok[i].nev + ': ' + e); continue; }
		if (!doc) continue;
		var jel = botvedelemJel(doc);
		if (jel) {
			naplo("Glob\u00e1lis", "Bot v\u00e9delem akt\u00edv!!! (" + ablakok[i].nev + ", " + jel + ")");
			BotvedelemBe();
			return;
		}
	}
}

/* Raising the alarm and polling it used to be the same function, which
   rescheduled itself every 2.5 seconds. isPageLoaded() calls it afresh every
   time a page check fails, so a second call started a second chain while
   BOTORA only ever remembered the newest one. The older chains could not be
   cancelled, and each kept setting BOT = true -- so after typing the captcha
   in, every module stayed frozen and the alarm kept sounding.

   Raising it is now separate from polling it, and refuses to start a second
   cycle while one is already running. */
function BotvedelemBe() {
	if (BOTORA) return; // a cycle is already polling; do not start another
	botvedelemTick();
}

function botvedelemTick() {
	BOTORA = 0; // this tick has fired; nothing is scheduled until the end
	try {
		let isload = true;
		BOT = true;
		if (!BOT_KEZDET) BOT_KEZDET = Date.now(); // first tick of this alarm
		if (!BOT_REF || BOT_REF.closed) {
			BOT_REF = window.open(VILL1ST);
			isload = false;
			throw "Waiting for auto-resolver...";
		} else if (!(BOT_REF.document.querySelector("#serverTime") && BOT_REF.document.querySelector("#serverTime").innerHTML.length > 4)) {
			isload = false;
		} else if (BOT_REF.document.getElementById('botprotection_quest')) {
			BOT_REF.document.getElementById('botprotection_quest').click();
		} else if (BOT_REF.document.getElementById('bot_check')) {
			if (BOT_REF.document.querySelector('#bot_check a'))
				BOT_REF.document.querySelector('#bot_check a').click();
		}
		/* The page itself says the check is gone. This is the only way out --
		   nothing resumes on anybody's say-so, his included. */
		if (isload && !botvedelemJel(BOT_REF.document)) {
			botvedelemFolytatas();
			return;
		}
		if (BOT_ELLENORZES) {
			/* Checking what he told us. Quiet, and short: if the page still shows
			   the check after this, say so and leave everything halted. */
			if (Date.now() - BOT_ELLENORZES_KEZDET >= BOT_ELLENORZES_MS) {
				botvedelemEllenorzesBukott();
				return;
			}
		} else {
			if (Date.now() - BOT_KEZDET >= BOT_HATARIDO_MS) {
				botvedelemFeladas();
				return;
			}
			soundVolume(BOT_HANGERO);
			playSound("bot2");
			alert2('BOT VÉDELEM!!!<br>Írd be a kódot, és kattints ide lentre!<br><br><a href="javascript: BotvedelemKi()">Beírtam a kódot, mehet tovább!</a>');
			if (SZEM4_SETTINGS.altbot && !ALTBOT2) {
				window.open(document.getElementById("altbotURL").value);
				ALTBOT2=true;
			}
		}
	} catch(e){ debug("BotvedelemBe()",e); }

	BOTORA = setTimeout(botvedelemTick, 2500);
}
/* Nobody answered in time. Stop making noise and let the window go, but
   leave every module halted -- see BOT_HATARIDO_MS above. */
function botvedelemFeladas() {
	BOT_FELADVA = true;
	clearTimeout(BOTORA); BOTORA = 0;
	stopSound(); soundVolume(0.0);
	botvedelemAblakZar();
	naplo('Bot v\u00e9delem \u26a0', `${Math.round(BOT_HATARIDO_MS / 60000)} perce nincs v\u00e1lasz az ellen\u0151rz\u00e9sre. Minden modul le\u00e1ll\u00edtva marad, am\u00edg meg nem oldod \u00e9s itt nem jelzed.`);
	alert2('BOT V\u00c9DELEM \u2014 nem \u00e9rkezett v\u00e1lasz.<br><br>Minden modul le van \u00e1ll\u00edtva. Old meg az ellen\u0151rz\u00e9st a j\u00e1t\u00e9kban, majd kattints ide.<br><br><a href="javascript: BotvedelemKi()">Megoldottam, mehet tov\u00e1bb!</a>');
}

/* The window may be gone already, or never have opened. */
function botvedelemAblakZar() {
	try { if (BOT_REF && !BOT_REF.closed) BOT_REF.close(); }
	catch (e) { debug('botvedelemAblakZar', e); }
	BOT_REF = null;
}

/* He says he has typed the code. Go and look.

   This used to set BOT = false on the spot, on trust. If he had misread the
   captcha, or solved it in one window while another still held it, every
   module started up again straight into a check that was still there.

   Nothing here decides anything: it fetches the page again and hands the
   question to the polling cycle, which already knows how to wait for a page
   to load and how to read it. Resuming happens in one place, botvedelemTick,
   and only because the page came back clean. */
function BotvedelemKi(){
	if (!BOT) return; // nothing is halted; there is nothing to confirm
	BOT_ELLENORZES = true;
	BOT_ELLENORZES_KEZDET = Date.now();
	stopSound();
	naplo('Bot v\u00e9delem', 'Ellen\u0151rz\u00f6m, hogy t\u00e9nyleg elt\u0171nt-e a bot v\u00e9delem...');
	alert2('Ellen\u0151rz\u00f6m, hogy t\u00e9nyleg feloldottad-e...');
	/* The window is still showing the page as it was, and he may have solved
	   the check somewhere else entirely. Ask the server, not the old DOM. */
	try { if (BOT_REF && !BOT_REF.closed) BOT_REF.location.href = VILL1ST; }
	catch (e) { debug('BotvedelemKi', e); botvedelemAblakZar(); } // gone; the tick opens a new one
	clearTimeout(BOTORA); BOTORA = 0;
	botvedelemTick();
}

/* Twenty seconds of looking and the check is still there. Say so plainly and
   change nothing else: BOT stays true, every module stays halted, and the
   link is still there to click again once he really has solved it. */
function botvedelemEllenorzesBukott() {
	BOT_ELLENORZES = false;
	clearTimeout(BOTORA); BOTORA = 0;
	soundVolume(1.0); // a stand-down may have muted it; do not leave it that way
	naplo('Bot v\u00e9delem \u26a0', 'Az ellen\u0151rz\u00e9s m\u00e9g mindig l\u00e1tszik. Minden modul le\u00e1ll\u00edtva marad.');
	alert2('M\u00e9g mindig l\u00e1tom az ellen\u0151rz\u00e9st.<br><br>Minden modul le van \u00e1ll\u00edtva. Old meg a j\u00e1t\u00e9kban, majd kattints ide \u00fajra.<br><br><a href="javascript: BotvedelemKi()">Be\u00edrtam a k\u00f3dot, mehet tov\u00e1bb!</a>');
}

/* The check really is gone -- botvedelemTick has just read the page and seen
   nothing. Only it calls this. */
function botvedelemFolytatas(){
	/* First, so that a failure below cannot leave a cycle running. Clearing the
	   handle as well as the timer matters: a stale non-zero BOTORA would make
	   BotvedelemBe() think a cycle was still polling and refuse to raise the
	   alarm ever again. */
	clearTimeout(BOTORA); BOTORA = 0;
	/* What was missed, before the figures are reset. Standing down closes the
	   window and nulls BOT_REF, so this path has to tolerate that. */
	if (BOT_KEZDET) {
		const percek = Math.max(1, Math.round((Date.now() - BOT_KEZDET) / 60000));
		naplo('Bot v\u00e9delem', `Feloldva. Az ellen\u0151rz\u00e9s ${new Date(BOT_KEZDET).toLocaleTimeString()}-kor jelent meg, a modulok kb. ${percek} percig \u00e1lltak${BOT_FELADVA ? ', k\u00f6zben a riaszt\u00e1s magat\u00f3l elhallgatott' : ''}.`);
	}
	BOT_KEZDET = 0; BOT_FELADVA = false; BOT_ELLENORZES = false;
	BOT=false; ALTBOT2=false;
	stopSound();
	soundVolume(1.0); // standing down muted it; without this every later sound is silent
	botvedelemAblakZar();
	alert2('Bot védelem rendben');
	/* Megnyitott lapok frissítése: they are sitting on the check page.

	   Navigating to the same address rather than calling .reload(): a farm
	   window can be sitting on the result of a POST, and reloading that
	   repeats the request -- which in this program means sending an attack
	   again. Assigning to location.href is a plain GET of the same page. */
	nyitottAblakok().forEach(function (ab) {
		try { ab.ablak.location.href = ab.ablak.location.href; }
		catch (e) { debug('botvedelemFolytatas', ab.nev + ' nem friss\u00edthet\u0151: ' + e); }
	});
}

function isPageLoaded(ref, faluid, address, elements=[]){try{
	if (ref.closed) return false;
	var botjel = botvedelemJel(ref.document);
	if (botjel) {
		/* Best-effort dismissal; the caller raises the alarm either way. */
		try{if (ref.document.getElementById('botprotection_quest')) ref.document.getElementById('botprotection_quest').click();}catch(e){}
		naplo("Globális","Bot védelem aktív!!! ("+botjel+")");
		BotvedelemBe();
		return false;
	}
	if (ref.document.location.href.indexOf("sid_wrong")>-1) {
		naplo("Globális","Kijelentkezett fiók. Jelentkezzen be újra, vagy állítsa le a programot.");
		BotvedelemBe();
		return false;
	}
	if (!address) return false;
	for (let i=0; i < elements.length; i++) {
		if (ref.document.querySelector(elements[i]) === null) return false;
	}
	if (address.indexOf("not ")>-1) var neg=true; else var neg=false;
	if (faluid>-1) if (ref.game_data.village.id!=faluid) return false;
	if (ref.document.getElementById("serverTime").innerHTML.length>4) {
		if (neg) {
			if (ref.document.location.href.indexOf(address.split(" ")[1]) == -1) return true;
		} else {
			if (ref.document.location.href.indexOf(address)>-1)	return true;
		}
	}
	return false;
}catch(e){return false;}}
function windowOpener(id, url, windowId) {
	return window.open(url, windowId);
}
function addTooltip(el, text) {
	removeTooltip(el.closest('.tooltip-wrapper'));
	$(el).children('.tooltip_text').css({"display": "block"})
	$(el).children('.tooltip_text').html(text);
}
function addTooltip_build(el, koord) {
	removeTooltip(el.closest('.tooltip-wrapper'));
	el.querySelector('.tooltip_text').style.display = "block";

	const isNew = koord in SZEM4_VIJE.ALL_VIJE_SAVED;
	if (isNew) el.querySelector('.tooltip_text').classList.remove('szem_old_build_tooltip'); else el.querySelector('.tooltip_text').classList.add('szem_old_build_tooltip');
	let buildingTooltip = `<table class="no-bg-table">`;
	const i18nBuildings=document.getElementById("vije_opts");
	for (let build in SZEM4_FARM.DOMINFO_FARMS[koord].buildings) {
		if (SZEM4_FARM.DOMINFO_FARMS[koord].buildings[build] < 1) continue;
		buildingTooltip += `<tr><td>${i18nBuildings[build].value}:</td><td>${SZEM4_FARM.DOMINFO_FARMS[koord].buildings[build]}</td></tr>`
	}
	buildingTooltip += '</table>';
	buildingTooltip += `<br><i>Felderítés ideje:<br>${isNew ? new Date(SZEM4_VIJE.ALL_VIJE_SAVED[koord]).toLocaleString() : 'Ismeretlen/régi'}</i>`
	el.querySelector('.tooltip_text').innerHTML = buildingTooltip;
}
function removeTooltip(el) {
	$(el).find('.tooltip_hover').each(function(i, el) {
		var thisText = $(el).children('.tooltip_text').html();
		if (thisText == "") return;
		$(el).children('.tooltip_text').html("");
		$(el).children('.tooltip_text').css({"display": "none"});
	});
}
function switchMobileMode() {
	MOBILE_MODE = !MOBILE_MODE;
	alert(`Mobile Mode = ${MOBILE_MODE}`);
}
function saveSettings() {
	const allOptions = document.getElementById('settings');
	Array.from(allOptions.elements).forEach((inputEl) => {
		if (inputEl.name) {
			if (inputEl.type === 'checkbox') {
				SZEM4_SETTINGS[inputEl.name] = inputEl.checked;
			} else if (inputEl.value) {
				SZEM4_SETTINGS[inputEl.name] = inputEl.value;
			}
		}
	});

	//Save Theme
	let themeId = SZEM4_SETTINGS.selectedProfile;
	if (themeId == undefined || isNaN(themeId) || themeId < 0 || themeId > 4) themeId = 1;
	const saveObj = SZEM4_SETTINGS[`profile${themeId}`];
	const themeOptions = document.querySelectorAll('#settings .style-settings-table input');
	themeOptions.forEach((inputEl) => {
		if (inputEl.name) {
			if (inputEl.type === 'checkbox') {
				saveObj[inputEl.name] = inputEl.checked;
			} else if (inputEl.value) {
				saveObj[inputEl.name] = inputEl.value;
			}
		}
	});
}
function loadSettings() {
	const allOptions = document.getElementById('settings');
	Array.from(allOptions.elements).forEach((input) => {
		if (input.name && SZEM4_SETTINGS[input.name] !== undefined) {
			if (input.type === 'checkbox') {
				input.checked = SZEM4_SETTINGS[input.name];
			} else if (input.value) {
				input.value = SZEM4_SETTINGS[input.name];
			}
		}
	});
	selectTheme(SZEM4_SETTINGS.selectedProfile);
}

function restartKieg(type) {
	worker.postMessage({'id': 'stopTimer', 'value': type});
	setTimeout(function() {
		switch (type) {
			case 'farm': szem4_farmolo_motor(); break;
			case 'vije': szem4_VIJE_motor(); break;
			case 'epit': szem4_EPITO_motor(); break;
		}
	}, 133);
}
function sendCustomEvent(messageId, data={}) {
	const customEvent = new CustomEvent(messageId, {
		detail: data
	});
	document.dispatchEvent(customEvent);
}
/* ------------------- FARMOLÓ ----------------------- */
/* --- guarded reads against the game's own pages ----------------------------
   These deliberately still THROW when an element is missing, because that is
   what the old inline chains did -- the enclosing catch aborts the step and
   the engine retries. Returning null instead would let callers carry on with
   NaN troop counts, which is worse than stopping.

   What they add is a name. A moved id used to surface as "can't access
   property X of null" from somewhere deep in a chain; now the debug log says
   which element was wanted and what it was for. */
/* Every module reaches other game screens by string-replacing "screen=overview"
   inside VILL1ST. That is only safe while the launch page is exactly
   screen=overview: "screen=overview" is a PREFIX of "screen=overview_villages",
   so launching from the villages list rewrites it to "screen=report_villages"
   -- not a real screen. Stray list-only params (group, page, mode=prod) ride
   along too, and the farm engine's own page check rejects any URL carrying an
   unexpected mode=.

   Setting parameters properly avoids the whole class. Pass null to drop one. */
function gameUrl(overrides) {
	var url = new URL(VILL1ST, document.location.href);
	for (var key in overrides) {
		if (overrides[key] === null || overrides[key] === undefined) url.searchParams.delete(key);
		else url.searchParams.set(key, overrides[key]);
	}
	return url.href;
}

/* Default state shapes. Declared once and used both to initialise and to
   reset, so the two cannot drift apart. */
function defaultFarmState() {
	return {
		ALL_UNIT_MOVEMENT: {}, // hova(koord): [[ teherbírás, mikorra(getTime()), VIJE miatti teherbírás ], ...]
		ALL_SPY_MOVEMENTS: {}, // hova(koord): mikor ment utoljára kém
		DOMINFO_FARMS: {},     // village: {prodHour, buildings, nyers, szin, isJatekos}
		DOMINFO_FROM: {},      // village: {isUnits, noOfUnits}
		OPTIONS: {}
	};
}
function defaultVijeState() {
	return {
		ALL_VIJE_SAVED: {}, // coord: a faluról készült legfrissebb elemzés ideje
		i18ns: {},          // épületId: fordítás
		ELEMZETT: []
	};
}
function defaultGyujtoState() {
	return { settings: { strategy: 'max' } };
}
/* The four colours the interface shipped with before it had a palette.

   The style boxes are saved as soon as anything on the sound panel is, so an
   instance that has been run even once has these sitting in storage -- not
   because they were chosen, but because they were what the boxes happened to
   hold. On load they are written back as inline styles, which beat the
   stylesheet, so without this the old yellow-framed look paints itself over
   the new palette on every start and the palette only half arrives.

   A value that is one of these is therefore treated as "never actually
   chosen" and replaced. Anything else is a colour that was typed in on
   purpose and is left exactly as it is. */
var REGI_STILUS_ALAP = {
	content_bgcolor:   { '#111': '#0b0d10' },
	content_fontcolor: { 'white': '#dfe4ea' },
	content_border:    { 'yellow': '#272e37' },
	content_shadow:    { '0 0 12px black': '0 2px 24px rgba(0,0,0,0.65)' },
	wallp_left:  { 'https://raw.githubusercontent.com/cncDAni2/klanhaboru/main/images/szem4/default_bg_left.jpg': '-' },
	wallp_right: { 'https://raw.githubusercontent.com/cncDAni2/klanhaboru/main/images/szem4/default_bg_right.jpg': '-' }
};

function upgradeStyleDefaults(settings) {
	if (!settings) return 0;
	var valtozott = 0;
	var helyek = [settings, settings.profile1, settings.profile2, settings.profile3, settings.profile4];
	helyek.forEach(function (hely) {
		if (!hely || typeof hely !== 'object') return;
		for (var kulcs in REGI_STILUS_ALAP) {
			var csere = REGI_STILUS_ALAP[kulcs][hely[kulcs]];
			if (csere !== undefined) { hely[kulcs] = csere; valtozott++; }
		}
	});
	return valtozott;
}

function defaultSettingsState() {
	return { selectedProfile: 1, profile1: {}, profile2: {}, profile3: {}, profile4: {} };
}

function pageUrl(ref) {
	try { return ref.document.location.href; } catch (e) { return '(nem olvashato ablak)'; }
}

function gameEl(ref, selector, what) {
	var el = ref.document.querySelector(selector);
	if (!el) throw new Error(`Hianyzo elem: ${what} [${selector}] -- a megnyitott oldal: ${pageUrl(ref)}`);
	return el;
}

function numFrom(el, what) {
	if (!el) throw new Error(`Hianyzo elem, nem olvashato szam: ${what}`);
	var found = el.textContent.match(/[0-9]+/g);
	if (!found) throw new Error(`Nincs szam ebben: ${what} ("${el.textContent.trim()}")`);
	return parseInt(found[0], 10);
}

function gameNum(ref, selector, what) {
	return numFrom(gameEl(ref, selector, what), what);
}

function drawWagons(koord) {
	let farms = document.getElementById('farm_hova').rows;
	if (!koord) {
		for (var i=1;i<farms.length;i++) {
			addWagons(farms[i]);
		}
	} else {
		for (var i=1;i<farms.length;i++) {
			if (farms[i].cells[0].textContent == koord) {
				addWagons(farms[i]);
				break;
			}
		}
	}
}
function addWagons(farmRow) {
	let koord = farmRow.cells[0].textContent;
	let attacks = SZEM4_FARM.ALL_UNIT_MOVEMENT[koord];
	
	farmRow.cells[5].innerHTML = ''; // Fixme: Nem csak ez van (Why? lesz?) itt, ne töröld az egészet
	if (!attacks) return;
	attacks.sort((a, b) => a[1] - b[1]);
	const tmp = document.createElement('div');
	tmp.setAttribute('class', 'tooltip-wrapper');
	let tmp_content = '';
	let prodHour = SZEM4_FARM.DOMINFO_FARMS[koord].prodHour;
	attacks.forEach((attack, index) => {
		let wagonType = 'wagon_normal.png';
		if (attack[2] > (prodHour * 5)) wagonType = 'wagon_nuclear.png';
		else if (attack[2] > (prodHour * 2)) wagonType = 'wagon_coal.png';
		else if (attack[2] < 5 && attack[0] < 5) wagonType = 'wagon_empty.png';

		let min = Math.round(convertTbToTime(farmRow.cells[1].textContent, attack[0]));
		tmp_content += `
		<span onmouseenter="setTooltip(this, ${index})" class="tooltip_hover">
			<img src="${pic(wagonType)}?v=4" title="" width="40px">
			<span class="wagon_time">${(min>3 && wagonType!='wagon_nuclear.png')?min:''}</span>
			<span class="tooltip_text"></span>
		</span>`
	});
	tmp.innerHTML = tmp_content;
	farmRow.cells[5].appendChild(tmp);
}
function setTooltip(el, index) {
	let farmRow = el.closest('tr');
	let farmCoord = farmRow.cells[0].textContent;
	let attack = [...SZEM4_FARM.ALL_UNIT_MOVEMENT[farmCoord][index]];
	let min = convertTbToTime(farmRow.cells[1].textContent, attack[0]);
	let kezdet = new Date(attack[1]);
	kezdet.setSeconds(kezdet.getSeconds() - (min * 60));
	min = min.toFixed(2);

	let content = `<table class="no-bg-table">
		<tr><td>Szerelvény hossza</td><td><div class="flex_middle">${min} perc (<img src="${pic('resource.png')}"> ${attack[0]})</div></td></tr>
		<tr><td>Szerelvény kezdete</td><td>${kezdet.toLocaleString()}</td></tr>
		<tr><td>Érkezés</td><td>${new Date(attack[1]).toLocaleString()}</td></tr>
		<tr><td>Extra nyers</td><td><div class="flex_middle"><img src="${pic('resource.png')}"> ${attack[2]}</div></td></tr>
		<tr><td>Nyerstermelés/óra</td><td>${getProdHour(farmRow.cells[1].textContent)}</td></tr>
	</table>
	<i>Utolsó jelentés: ${SZEM4_VIJE.ALL_VIJE_SAVED[farmCoord] ? new Date(SZEM4_VIJE.ALL_VIJE_SAVED[farmCoord]).toLocaleString() : 'Nincs'}</i>`;
	addTooltip(el, content);
}
/* Distance from a farm to the nearest village you farm from -- the same
   measure the engine uses when it chooses which village attacks, so ordering
   by this column brings the cheapest targets to reach to the top. Null while
   no attacking village exists, because there is nothing to measure from. */
function farmDistance(koord) {
	let best = null;
	for (const attacker in SZEM4_FARM.DOMINFO_FROM) {
		const d = distCalc(koord.split('|'), attacker.split('|'));
		if (best === null || d < best) best = d;
	}
	return best;
}

/* Recomputed rather than stored: it depends on which villages you farm from,
   so a saved figure would go stale the moment one is added or removed. */
function refreshFarmDistances() {try{
	const table = document.getElementById('farm_hova');
	if (!table) return; // interface not built yet
	const rows = table.rows;
	for (let i = 1; i < rows.length; i++) {
		const cell = rows[i].cells[6];
		if (!cell) continue;
		const d = farmDistance(rows[i].cells[0].textContent);
		cell.innerHTML = d === null ? '' : d.toFixed(1);
	}
}catch(e){ debug('refreshFarmDistances', e); }}

function add_farmolando(){try{
	let addFarmolandoFaluk = document.getElementById('add_farmolando_faluk');
	var faluk = addFarmolandoFaluk.value;
	if (faluk == '') return;
	var patt = new RegExp(/[0-9]+(\|)[0-9]+/);
	if (!patt.test(faluk)) throw "Nincs érvényes koordináta megadva";
	faluk = faluk.match(/[0-9]+(\|)[0-9]+/g);
	
	var dupla='';
	let defaultProdHour = parseInt(document.getElementById('farmolo_options').termeles.value,10);
	for (var i=0;i<faluk.length;i++) {
		if (SZEM4_FARM.DOMINFO_FARMS[faluk[i]] || SZEM4_FARM.DOMINFO_FROM[faluk[i]]) {
			dupla+=faluk[i] + ', ';
			faluk[i] = '';
			continue;
		}
		const a=document.getElementById("farm_hova");
		const a_row=a.insertRow(-1); 
		var c=a_row.insertCell(0); c.innerHTML=faluk[i]; c.setAttribute("ondblclick","hattertolor(this)");
		var c=a_row.insertCell(1); c.innerHTML=""; c.setAttribute("ondblclick",'sortorol(this,"hova")');
		var c=a_row.insertCell(2);
			c.innerHTML=`<span class="tooltip_hover">
				0
				<span class="tooltip_text"></span>
			</span>`;
			c.setAttribute("ondblclick","hattercsere(this)");
			c.setAttribute("onclick","learnCatapult(this)");
			c.setAttribute("onmouseenter",`addTooltip_build(this, '${faluk[i]}')`);
			c.setAttribute("onmouseleave",'removeTooltip(this)');
		var c=a_row.insertCell(3); c.innerHTML="0"; c.setAttribute("ondblclick",'modosit_szam(this)');
		var c=a_row.insertCell(4); c.innerHTML='<input type="checkbox" onclick="szem4_farmolo_multiclick(0,\'hova\',this.checked)">';
		var c=a_row.insertCell(5); c.innerHTML=""; c.setAttribute("onmouseleave",'removeTooltip(this)');
		var c=a_row.insertCell(6); c.innerHTML="";
		SZEM4_FARM.DOMINFO_FARMS[faluk[i]] = {
			prodHour: defaultProdHour,
			buildings: {},
			nyers: 0,
			szin: {
				falu: '',
				fal: '',
				marks: ''
			},
			isJatekos: false
		};
	}
		
	addFarmolandoFaluk.value="";
	refreshFarmDistances();
	let text = '';
	if (Object.keys(SZEM4_FARM.DOMINFO_FARMS).length > 200) {
		text += 'Túl sok farm, csak az első 200-at jelenítem meg (ettől még aktívak és szűrhetőek/rendezhetőek)\n';
	}
	hideFarms();
	if (dupla!="") text+='Dupla falumegadások kiszűrve:\n' + dupla;
	if (text !== '') alert2(text);
	return;	
}catch(e){alert(e);}}
function add_farmolo(){ try{
	const addFaluk = document.getElementById('add_farmolo_faluk');
	let faluk = addFaluk.value;
	if (faluk == '') return;
	const patt = new RegExp(/[0-9]+(\|)[0-9]+/);
	if (!patt.test(faluk)) throw "Nincs érvényes koordináta megadva";
	faluk = faluk.match(/[0-9]+(\|)[0-9]+/g);
	
	if (!document.querySelector('#add_farmolo_egysegek input:checked')) {
		if (!confirm('Nincs semmilyen egység megadva, amit küldhetnék. Folytatod?\n(később ez a megadás módosítható)')) return;
	}
	
	for (var i=0;i<faluk.length;i++) {
		if (!SZEM4_FARM.DOMINFO_FROM[faluk[i]] && KTID[faluk[i]]) {
			SZEM4_FARM.DOMINFO_FROM[faluk[i]] = {
				isUnits: {},
				noOfUnits: {}
			};
			document.querySelectorAll('#add_farmolo_egysegek input').forEach((el) => {
				SZEM4_FARM.DOMINFO_FROM[faluk[i]].isUnits[el.name] = el.checked;
				SZEM4_FARM.DOMINFO_FROM[faluk[i]].noOfUnits[el.name] = 999;
			});

			debug('add_farmolo', `Calling add_attackerRow with ${faluk[i]}`);
			add_attackerRow(faluk[i]);
		}
	}
	addFaluk.value="";
	return;	
} catch(e) {
	alert(e);
}}

/**
 * @description Limitálja hogy max 200 farm jelenjen meg egyszerre, performancia okok végett
 */
function hideFarms() {
	const allFarm = document.getElementById('farm_hova').rows;
	let visible = 0;
	for (let i=0;i<allFarm.length;i++) {
		if (allFarm[i].style.display !== 'none') visible++;
		if (visible > 200) allFarm[i].classList.add('szem4_farms_overflow'); else allFarm[i].classList.remove('szem4_farms_overflow');
	}
}

function add_attackerRow(attackerCoord) {
	debug('add_attackerRow', `Added new vill ${attackerCoord}`);
	const attackerRow = document.querySelector(`#ffrom_${attackerCoord.replace('|','-')}`);
	if (!attackerRow) {
		// CREATE
		const a = document.getElementById("farm_honnan");
		const b = a.insertRow(-1);
		b.setAttribute('id', `ffrom_${attackerCoord.replace('|','-')}`);
		let c = b.insertCell(0);
		c.innerHTML = attackerCoord;
		c.setAttribute("ondblclick",'sortorol(this,"honnan")');
	
		c = b.insertCell(1);
		c.innerHTML = rovidit("egysegek");
		c.querySelectorAll('input').forEach((el) => {
			el.checked = SZEM4_FARM.DOMINFO_FROM[attackerCoord].isUnits[el.name];
		});
	} else {
		// UPDATE (Not a valid case)
		debug('add_attackerRow', 'Invalid case: No update possible');
	}
	refreshFarmDistances(); // a new attacking village moves every farm's nearest
}

function rebuildDOM_farm() {try{
	// BEÁLLÍTÁSOK
	const optsForm = document.querySelector('#farmolo_options');
	for (const el of optsForm) {
		if (!el.name || SZEM4_FARM.OPTIONS[el.name] == undefined) continue;
		if (el.type == 'checkbox') {
			el.checked = SZEM4_FARM.OPTIONS[el.name];
		} else {
			el.value = SZEM4_FARM.OPTIONS[el.name];
		}
	}

	// FARMOLÓ FALUK
	$("#farm_honnan tr:gt(0)").remove();
	for (let attacker in SZEM4_FARM.DOMINFO_FROM) {
		add_attackerRow(attacker);
	}
	debug('rebuildDOM_farm', '(1) Loading debug: FROM = ' + JSON.stringify(SZEM4_FARM.DOMINFO_FROM));

	// FARMOK
	const farmTable = document.getElementById('farm_hova');
	$("#farm_hova tr:gt(0)").remove();
	for (let farm in SZEM4_FARM.DOMINFO_FARMS) {
		SZEM4_FARM.DOMINFO_FARMS[farm].szin = SZEM4_FARM.DOMINFO_FARMS[farm].szin || {};
		const a_row = farmTable.insertRow(-1);
		// HOVA
		let c = a_row.insertCell(0);
		c.innerHTML=farm;
		c.setAttribute("ondblclick","hattertolor(this)");
		if (SZEM4_FARM.DOMINFO_FARMS[farm].szin.falu) c.style.backgroundColor = SZEM4_FARM.DOMINFO_FARMS[farm].szin.falu;
		
		// BÁNYÁK
		const buildings = SZEM4_FARM.DOMINFO_FARMS[farm].buildings;
		c=a_row.insertCell(1);
		if (buildings.wood == undefined) {
			SZEM4_FARM.DOMINFO_FARMS[farm].prodHour = parseInt(document.getElementById('farmolo_options').termeles.value, 10);
		} else {
			let banyak = `${buildings.wood},${buildings.stone},${buildings.iron}`;
			c.innerHTML=`${banyak}`;
			SZEM4_FARM.DOMINFO_FARMS[farm].prodHour = getProdHour(banyak);
		}
		c.style.backgroundColor = SZEM4_FARM.DOMINFO_FARMS[farm].szin.banya;
		c.setAttribute("ondblclick",'sortorol(this,"hova")');
		
		// FAL
		c=a_row.insertCell(2);
		let fal = '';
		if (buildings.wall !== undefined) {
			fal = parseInt(buildings.wall,10);
			if (fal == 0) {
				if (buildings.main == 1) fal -= 2;
				if (buildings.main == 2) fal -= 1;
				if (buildings.barracks == 0) fal -= 1;
			}
		}
		c.innerHTML=`<span class="tooltip_hover">
			${fal}
			<span class="tooltip_text"></span>
		</span>`;
		c.setAttribute("onmouseenter",`addTooltip_build(this, '${farm}')`);
		c.setAttribute("ondblclick","hattercsere(this)");
		c.setAttribute("onclick","learnCatapult(this)");
		c.setAttribute("onmouseleave",'removeTooltip(this)');
		if (SZEM4_FARM.DOMINFO_FARMS[farm].szin.fal) c.style.backgroundColor = SZEM4_FARM.DOMINFO_FARMS[farm].szin.fal;
		if (SZEM4_FARM.DOMINFO_FARMS[farm].szin.marks) c.style.border = `2px solid ${SZEM4_FARM.DOMINFO_FARMS[farm].szin.marks}`;
		
		// NYERS
		c=a_row.insertCell(3); c.innerHTML=SZEM4_FARM.DOMINFO_FARMS[farm].nyers; c.setAttribute("ondblclick",'modosit_szam(this)');
		
		// J?
		c=a_row.insertCell(4); c.innerHTML=`<input type="checkbox" onclick="szem4_farmolo_multiclick(0,\'hova\',this.checked)" ${SZEM4_FARM.DOMINFO_FARMS[farm].isJatekos?'checked':''}>`;
		
		// WAGONS
		c=a_row.insertCell(5); c.innerHTML=""; c.setAttribute("onmouseleave",'removeTooltip(this)');
		drawWagons(farm);

		// TÁV
		c=a_row.insertCell(6); c.innerHTML="";
	}
	refreshFarmDistances();
	hideFarms();
	debug('rebuildDOM_farm', '(2) Loading debug: FROM = ' + JSON.stringify(SZEM4_FARM.DOMINFO_FROM));
} catch(e) {
	debug('rebuildDOM_farms', e);
	alert2('ERROR__ rebuild: \n' + e);
}}

function learnCatapult(el){
	let coord = el.closest('tr').cells[0].textContent;
	let toCatapult = {};
	const ignoreCatapult=['wood', 'stone', 'iron', 'wall'];
	const i18nBuildings=document.getElementById("vije_opts");
	for (let b in SZEM4_FARM.DOMINFO_FARMS[coord].buildings) {
		if (ignoreCatapult.includes(b) || SZEM4_FARM.DOMINFO_FARMS[coord].buildings[b] == 0) continue;
		toCatapult[i18nBuildings[b].value] = SZEM4_FARM.DOMINFO_FARMS[coord].buildings[b];
	}
	alert2(`Katapultozó script betanítva \n ${coord}`);
	console.info(coord, toCatapult);
	localStorage.setItem('cnc_katapult', `;${coord};${JSON.stringify(toCatapult)}`);
}

function szem4_farmolo_multiclick(no,t,mire){try{
	if (!(document.getElementById("farm_multi_"+t).checked)) return;
	var x=document.getElementById("farm_"+t).rows;
	if (t=="honnan") t=1; else t=4;
	for (var i=1;i<x.length;i++) {
		if (x[i].style.display!="none") x[i].cells[t].getElementsByTagName("input")[no].checked=mire;
	}
	return;
}catch(e){alert2("Hiba: "+t+"-"+no+"\n"+e);}}
function szem4_farmolo_csoport(tabla){try{
	var lista = prompt("Faluszűrő\nAdd meg azon faluk koordinátáit, melyeket a listában szeretnél látni. A többi falu csupán láthatatlan lesz, de tovább folyik a használata.\nSpeciális lehetőségid:\n-1: Csupán ezt az értéket adva meg megfordítódik a jelenlegi lista láthatósága (negáció)\n-...: Ha az első karakter egy - jel, akkor a felsorolt faluk kivonódnak a jelenlegi listából (különbség)\n+...: Ha az első karaktered +, akkor a felsorolt faluk hozzáadódnak a listához (unió)\nÜresen leokézva az összes falu láthatóvá válik");
	if (lista==null) return;
	var type="norm";
	if (lista=="-1") type="negalt";
		else {
			if (lista[0]=="-") type="kulonbseg";
			if (lista[0]=="+") type="unio";
		}
	if (lista=="") type="all";
	if (lista=="S") type="yellow";
	lista=lista.match(/[0-9]+(\|)[0-9]+/g);
	var uj=false; var jel;
	var x=document.getElementById("farm_"+tabla).rows;
	for (var i=1;i<x.length;i++) {
		uj=false; jel=x[i].cells[0].textContent;
		switch(type) {
			case "norm": if (lista.indexOf(jel)>-1) uj=true; break;
			case "negalt": if (x[i].style.display=="none") uj=true; break;
			case "kulonbseg": if (x[i].style.display!="none" && lista.indexOf(jel)==-1) uj=true; break;
			case "unio": if (x[i].style.display!="none" || lista.indexOf(jel)>-1) uj=true; break;
			case "all": uj=true; break;
			case "yellow": if (x[i].cells[0].style.backgroundColor=="yellow") uj=true; break;
		}
		if (uj) x[i].setAttribute("style","display:line"); else x[i].setAttribute("style","display:none");
	}
	hideFarms();
}catch(e){alert2("Hiba: \n"+e);}}
function getAllResFromVIJE(coord) {
	var allAttack = SZEM4_FARM.ALL_UNIT_MOVEMENT[coord];
	if (!allAttack) return 0;
	var allRes = 0;
	for (let att in allAttack) {
		allRes+=allAttack[att][2];
	}

	if (isNaN(allRes)) {debug('getAllResFromVIJE', 'allRes is NaN at ' + coord + ': ' + JSON.stringify(allAttack)); return 0;}
	return allRes;
}
function subtractNyersValue(coord, val) {
	var nyersTable = document.getElementById('farm_hova').rows;
	var cells;
	for (var i=1;i<nyersTable.length;i++) {
		cells = nyersTable[i].cells;
		if (cells[0].textContent == coord) {
			var oldValue = parseInt(cells[3].innerText,10);
			oldValue-=val;
			if (oldValue<0) oldValue=0;
			cells[3].innerHTML = oldValue;
			SZEM4_FARM.DOMINFO_FARMS[coord].nyers = oldValue;
			break;
		}
	}
}
function clearAttacks() {try{
	const currentTime = getServerTime().getTime();
	for (let item in SZEM4_FARM.ALL_UNIT_MOVEMENT) {
		// Current utáni érkezések kivágása
		var outdatedArrays = [];
		for (var i=SZEM4_FARM.ALL_UNIT_MOVEMENT[item].length-1;i>=0;i--) {
			// Ha VIJE nyersért ment csak, töröljük
			if (SZEM4_FARM.ALL_UNIT_MOVEMENT[item][i][1] <= currentTime && SZEM4_FARM.ALL_UNIT_MOVEMENT[item][i][0] < 30) {
				subtractNyersValue(item, SZEM4_FARM.ALL_UNIT_MOVEMENT[item][i][2]);
				SZEM4_FARM.ALL_UNIT_MOVEMENT[item].splice(i, 1);
				drawWagons(item);
				continue;
			}
			if (SZEM4_FARM.ALL_UNIT_MOVEMENT[item][i][1] <= currentTime - (MAX_IDO_PERC * 60000 * 2)) { // Kuka, ha nagyon régi
				SZEM4_FARM.ALL_UNIT_MOVEMENT[item].splice(i, 1);
				drawWagons(item);
				continue;
			}
			if (SZEM4_FARM.ALL_UNIT_MOVEMENT[item][i][1] <= currentTime) outdatedArrays.push(SZEM4_FARM.ALL_UNIT_MOVEMENT[item][i]);
		}
		// Beérkezett támadások nyerstörlése
		if (!outdatedArrays) continue;
		for (let movement of outdatedArrays) {
			if (movement.length != 3) {
				debug('clearAttacks', 'Anomaly, nem szabályszerű mozgás ('+item+'):'+JSON.stringify(movement)+' -- össz:'+JSON.stringify(outdatedArrays));
			}
			if (movement[2] > 0) {
				subtractNyersValue(item, movement[2]);
				movement[2] = 0;
			}
		}

		if (outdatedArrays.length < 2) continue;
		// Leghamarábbi keresése
		var closestArray = outdatedArrays.reduce(function(prev, current) {
			return (current[1] > prev[1]) ? current : prev;
		}, outdatedArrays[0]);

		SZEM4_FARM.ALL_UNIT_MOVEMENT[item] = SZEM4_FARM.ALL_UNIT_MOVEMENT[item].filter(function(array) {
			return array[1] >= closestArray[1];
		});
		drawWagons(item);
	}
	for (let item in SZEM4_VIJE.ALL_VIJE_SAVED) {
		if (SZEM4_VIJE.ALL_VIJE_SAVED[item] < currentTime - (3 * 60 * 60000)) {
			subtractNyersValue(item, 400000);
			delete SZEM4_VIJE.ALL_VIJE_SAVED[item];
		}
	}
}catch(e) {debug('clearAttacks', e);}}

function getProdHour(banyaszintek) {
	var prodHour = 0;
	if (banyaszintek.split(',').length < 3) {
		prodHour=document.getElementById("farmolo_options").termeles.value;
		if (prodHour != "") prodHour = parseInt(prodHour, 10); else prodHour = 1000;
	} else {
		var r=banyaszintek.split(",").map(item => parseInt(item, 10));
		prodHour=(TERMELES[r[0]]+TERMELES[r[1]]+TERMELES[r[2]])*SPEED;
	}
	return parseFloat(prodHour.toFixed(2),10);
}
function updateDefaultProdHour() {
	const newProdHour = parseInt(document.getElementById('farmolo_options').termeles.value, 10);
	for (let koord in SZEM4_FARM.DOMINFO_FARMS) {
		if (SZEM4_FARM.DOMINFO_FARMS[koord].buildings.iron || SZEM4_FARM.DOMINFO_FARMS[koord].buildings.stone || SZEM4_FARM.DOMINFO_FARMS[koord].buildings.wood) continue;
		SZEM4_FARM.DOMINFO_FARMS[koord].prodHour = newProdHour;
	}
}
function getResourceProduction(prodHour, idoPerc) {try{
	// idoPerc alatt termelt mennyiség. idoperc MAX=megbízhatósági idő, vagy amennyi idő megtermelni határszám-nyi nyerset
	// var corrigatedMaxIdoPerc = getCorrigatedMaxIdoPerc(banyaszintek);
	if (idoPerc == 'max') idoPerc = parseInt(document.getElementById('farmolo_options').megbizhatosag.value, 10);
	// if (idoPerc == 'max') idoPerc = corrigatedMaxIdoPerc;

	var idoOra = idoPerc/60;
	return Math.round(prodHour * idoOra);
}catch(e) {debug('getResourceProduction', e);}}
function convertTbToTime(banyaszintek, tb) {
	var termeles = getProdHour(banyaszintek); // 1000 
	var idoPerc = (tb / termeles) * 60;
	return idoPerc;
}
function calculateNyers(farmCoord, travelTimeMinutes) {try{
	// Kiszámolja a többi támadásokhoz képest, mennyi a lehetséges nyers, kivonva amiért már megy egység.
	// Az érkezési idő +-X perc közötti rablási lefedettséget néz
	var foszthatoNyers = 0;
	var arriveTime = getServerTime();
	arriveTime.setSeconds(arriveTime.getSeconds() + (travelTimeMinutes * 60));
	arriveTime = arriveTime.getTime();
	if (!SZEM4_FARM.ALL_UNIT_MOVEMENT[farmCoord]) {
		foszthatoNyers = getResourceProduction(SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour, 'max');
		return foszthatoNyers;
	}
	let allAttack = SZEM4_FARM.ALL_UNIT_MOVEMENT[farmCoord];
	// Vonat:   [ ---- lastBefore ----|]        [ ---- firstAfter ---- |]
	//                         [ ---- arriveTime ----|]
	var closests = findClosestTimes(allAttack, arriveTime);
	var lastBefore = closests[0],
		firstAfter = closests[1];
	if (lastBefore) {
		foszthatoNyers+=getResourceProduction(SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour, (arriveTime - lastBefore[1]) / 60000);
	} else {
		foszthatoNyers+=getResourceProduction(SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour, 'max');
	}

	if (firstAfter) {
		let prodHour = SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour;
		let minimumFrom = 0;

		for (let i=0; i<allAttack.length; i++) {
			if (allAttack[i][1] > arriveTime) {
				let lefedesIdo = (allAttack[i][0] / prodHour) * 60 * 60000
				let from = allAttack[i][1] - lefedesIdo;
				if (minimumFrom == 0 || minimumFrom > from) minimumFrom = from;
			}
		}
		if (minimumFrom < arriveTime)
			foszthatoNyers -= getResourceProduction(SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour, (arriveTime - minimumFrom) / 60000);
	}
	return foszthatoNyers;
}catch(e) {debug('calculateNyers', e);}}
function findClosestTimes(allAttack, arriveTime) {
	let lastBefore = null;
	let firstAfter = null;

	for (let i=0; i<allAttack.length; i++) {
		if (allAttack[i][0] < 50) continue;
		let d = allAttack[i][1];
		if (d < arriveTime) {
			if (!lastBefore || d > lastBefore[1]) lastBefore = allAttack[i];
		} else if (d > arriveTime) {
			if (!firstAfter || d < firstAfter[1]) firstAfter = allAttack[i];
		}
	}

	return [lastBefore, firstAfter];
}
/* The confirm page's own capacity figure is authoritative because it accounts
   for any carry-modifier effect, so it stays the preferred source. But its
   markup has moved at least once (the V100 update nulled this selector), and a
   throw here aborted the whole raid record -- which left every farm looking
   permanently full and pinned the farm engine to a single village. Summing the
   units we already decided to send is markup-independent, so it backs it up. */
function readCarryCapacity(formEl, plannedUnits, farmCoord) {
	var cell = formEl.querySelector('.icon.header.ressources');
	if (cell && cell.parentElement) {
		var scraped = parseInt(cell.parentElement.innerText.replace(/\./g, ''), 10);
		if (!isNaN(scraped) && scraped > 0) return scraped;
	}
	var summed = 0;
	for (var unit in plannedUnits) {
		if (unit === 'pop' || !TEHER[unit]) continue;
		summed += plannedUnits[unit] * TEHER[unit];
	}
	if (summed > 0) return summed;
	debug('readCarryCapacity', 'Nem allapithato meg a teherbiras: ' + farmCoord);
	return 0;
}

function addCurrentMovementToList(formEl, farmCoord, farmHelyRow, plannedUnits) {try{
	var patternOfIdo = /<td>[0-9]+:[0-9]+:[0-9]+<\/td>/g;
	var travelTime = formEl.innerHTML.match(patternOfIdo)[0].match(/[0-9]+/g);
	travelTime = parseInt(travelTime[0],10) * 3600 + parseInt(travelTime[1],10) * 60 + parseInt(travelTime[2],10);
	var arriveTime = getServerTime();
	arriveTime.setSeconds(arriveTime.getSeconds() + travelTime);
	arriveTime = arriveTime.getTime();

	var teherbiras = readCarryCapacity(formEl, plannedUnits, farmCoord);
	var VIJE_teher = 0;
	var VIJE_nyers = SZEM4_FARM.DOMINFO_FARMS[farmCoord].nyers;
	if (VIJE_nyers > 0) {
		VIJE_nyers-=getAllResFromVIJE(farmCoord);
		if (VIJE_nyers > 0) {
			VIJE_teher = Math.min(teherbiras, VIJE_nyers);
			teherbiras-=VIJE_teher;
		}
	}

	if (teherbiras < 10 && VIJE_teher < 10) {
		debug('addCurrentMovementToList', `ERROR: teherbírás=0; Farm: ${farmCoord} | Innen: ${FARM_REF.game_data.village.display_name}`);
	}
	var allAttack = SZEM4_FARM.ALL_UNIT_MOVEMENT[farmCoord];
	if (!allAttack) {
		SZEM4_FARM.ALL_UNIT_MOVEMENT[farmCoord] = [[teherbiras, arriveTime, VIJE_teher]];
	} else {
		allAttack.push([teherbiras, arriveTime, VIJE_teher]);
	}
	addWagons(farmHelyRow);
	// KÉM?
	var spyIcon = FARM_REF.document.getElementById('place_confirm_units');
	spyIcon = spyIcon && spyIcon.querySelector('[data-unit="spy"] img');
	if (spyIcon && !spyIcon.classList.contains('faded')) {
		if (!SZEM4_FARM.ALL_SPY_MOVEMENTS[farmCoord] || SZEM4_FARM.ALL_SPY_MOVEMENTS[farmCoord] < arriveTime) SZEM4_FARM.ALL_SPY_MOVEMENTS[farmCoord] = arriveTime;
	}
}catch(e) {debug('addCurrentMovementToList', e); console.error(e);}}

function planAttack(farmRow, nyers_VIJE, bestSpeed, hatarszam) {try{
	// Megtervezi, miből mennyit küldjön SZEM. Falu megnyitása után intelligensen még módosíthatja ezt (2. lépés) (nem változtatva a MAX_SPEED-et)
	const farmCoord = farmRow.cells[0].textContent;
	const allOptions = document.getElementById('farmolo_options');
	const minSereg = parseInt(allOptions.minsereg.value, 10);
	const maxTavPerc = parseInt(allOptions.maxtav_ora.value, 10) * 60 + parseInt(allOptions.maxtav_p.value, 10);
	let plan = {};

	for (let attacker in SZEM4_FARM.DOMINFO_FROM) {
		let unifiedTraverTime = (1/SPEED)*(1/UNIT_S);
		unifiedTraverTime = unifiedTraverTime*(distCalc(farmCoord.split("|"), attacker.split("|"))); /*a[i]<->fromVillRow távkeresés*/
		
		// Távolásszűrő: MAX távon belüli, legjobb?
		let priority = getSlowestUnit(SZEM4_FARM.DOMINFO_FROM[attacker]);
		if (priority == '') continue;
		while(true) {
			if (unifiedTraverTime * E_SEB[priority] > maxTavPerc) {
				if (priority == 'heavy') {
					if (unifiedTraverTime * E_SEB.light > maxTavPerc) break;
					priority = 'light'; // Talán!
				} else if (priority == 'sword') {
					if (unifiedTraverTime * E_SEB.spear > maxTavPerc) break;
					priority = 'spear'; // Talán!
				} else break;
			}
			let myTime = unifiedTraverTime * E_SEB[priority];
			if (bestSpeed !== -1 && myTime > bestSpeed) break;

			// Mennyi nyerset tudnék hozni? Határszámon belül van?
			let nyers_termeles = calculateNyers(farmCoord, myTime);
			if (isNaN(nyers_termeles)) { nyers_termeles = 0; debug('planAttack', `nyers_termeles = NaN - ${farmCoord}`); }
			if (isNaN(nyers_VIJE)) { nyers_VIJE = 0; debug('planAttack', `nyers_VIJE = NaN - ${farmCoord}`); } 
			if (!(Number.isInteger(nyers_VIJE) && Number.isInteger(nyers_termeles))) debug('planAttack', `Nem is szám: nyers_VIJE=${nyers_VIJE} -- nyers_termeles=${nyers_termeles}`);
			let max_termeles = Math.ceil((SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour / 60) * SZEM4_FARM.OPTIONS.megbizhatosag);
			nyers_termeles = Math.min(nyers_termeles, max_termeles);

			let isMax = nyers_termeles >= max_termeles * 0.95;
			let teher = nyers_VIJE + nyers_termeles;
			if (teher < hatarszam) {
				if (priority == 'heavy' || priority == 'light') {
					priority = 'sword';
					continue;
				}
				break;
			}

			// buildArmy - mivel getSlowestUnit kérés volt, így ebből az egységből biztos van, nem lehet 0
			let plannedArmy = buildArmy(SZEM4_FARM.DOMINFO_FROM[attacker], priority, teher, isMax);
			if (plannedArmy.units.pop == 0) break;
			if (!isMax && (plannedArmy.units.pop < minSereg || plannedArmy.teher < hatarszam)) {
				break;
			}
			bestSpeed = myTime;
			plan = {
				fromVill: attacker,
				farmVill: farmCoord,
				units: {...plannedArmy.units},
				travelTime: myTime,
				slowestUnit: priority,
				nyersToFarm: teher,
				debug_teher: plannedArmy.teher,
				debug_hatar: hatarszam,
				isMax: isMax
			};
			break;
		}
	}
	return plan;
	//	Megállapítani, mennyi nyersért kell menni , prió heavy > light > sword > spear
	//		Megnézi pl. heavy-vel, ha nem 0 van belőle: erre számol egyet.
	//			Ha a távolság > min(eddigi_legjobb_terv, bestSpeed): újratervezés kl-ekkel (csak heavy/sword esetén!) (!! bestSpeed=0 -> nincs még legjobb)
	//			Ha ez határszám alatti: újratervezés gyalogosokkal
	//			Ha max táv-on túl van: újratervezés light/march-al (csak heavy esetén!)
	//			Ha TERV során nem tudtunk elég egységet megfogni, újratervezés gyalogosokkal
	//	Ha a végén üres az eddigi_legjobb_terv, akkor return "NO_PLAN"; -> ugrás a következő farmra
}catch(e) {console.error(e); debug('planAttack', e);}}
function buildArmy(attacker, priorityType, teher, isMax) {try{
	let originalTeher = teher;
	const availableUnits = UNITS.reduce((obj, unit) => {
		obj[unit] = attacker.isUnits[unit] ? attacker.noOfUnits[unit] : 0;
		return obj;
	}, {});

	const unitToSend = { pop: 0 };
	let temp_plan = {};
	switch (priorityType) {
		// ----------- LOVASSÁG -------------
		case 'heavy':
			temp_plan = useUpUnit('heavy', teher);
			if (temp_plan.pop == 0)
				return {
					units: unitToSend,
					teher: originalTeher - teher
				};
			teher -= temp_plan.teher;
			unitToSend.heavy = temp_plan.unit;
			unitToSend.pop += temp_plan.pop;
			if (!(isMax && temp_plan.pop == 0) && teher < 40)	break;
		case 'light':
			temp_plan = useUpUnit('marcher', teher);
			if (temp_plan.pop !== 0) {
				teher -= temp_plan.teher;
				unitToSend.marcher = temp_plan.unit;
				unitToSend.pop += temp_plan.pop;
			}
			if (!(isMax && temp_plan.pop == 0) && teher < 40)	break;

			temp_plan = useUpUnit('light', teher);
			if (temp_plan.pop !== 0) {
				teher -= temp_plan.teher;
				unitToSend.light = temp_plan.unit;
				unitToSend.pop += temp_plan.pop;
			}
			break;
		// ----------- GYALOGOS -------------
		case 'sword':
			temp_plan = useUpUnit('sword', teher);
			if (temp_plan.pop == 0)
				return {
					units: unitToSend,
					teher: originalTeher - teher
				};
			teher -= temp_plan.teher;
			unitToSend.sword = temp_plan.unit;
			unitToSend.pop += temp_plan.pop;
			if (!(isMax && temp_plan.pop == 0) && teher < 40)	break;
		case 'spear':
			temp_plan = useUpUnit('spear', teher);
			if (temp_plan.pop !== 0) {
				teher -= temp_plan.teher;
				unitToSend.spear = temp_plan.unit;
				unitToSend.pop += temp_plan.pop;
			}
			if (!(isMax && temp_plan.pop == 0) && teher < 20)	break;

			temp_plan = useUpUnit('axe', teher);
			if (temp_plan.pop !== 0) {
				teher -= temp_plan.teher;
				unitToSend.axe = temp_plan.unit;
				unitToSend.pop += temp_plan.pop;
			}
			if (!(isMax && temp_plan.pop == 0) && teher < 20)	break;

			temp_plan = useUpUnit('archer', teher);
			if (temp_plan.pop !== 0) {
				teher -= temp_plan.teher;
				unitToSend.archer = temp_plan.unit;
				unitToSend.pop += temp_plan.pop;
			}
			break;
	}

	return {
		units: unitToSend,
		teher: originalTeher - teher
	};

	function useUpUnit(type, teher) {
		const usedUp = {
			pop: 0,
			unit: 0,
			teher: 0
		}
		if (availableUnits[type] == undefined || availableUnits[type] < 1) return usedUp;
		if (availableUnits[type] * TEHER[type] > teher) {
			usedUp.unit = Math.round(teher / TEHER[type]);
			if (isMax && usedUp.unit == 0) { usedUp.unit = 1; }
		} else {
			usedUp.unit = availableUnits[type];
		}
		usedUp.pop = usedUp.unit * TANYA[type];
		usedUp.teher = usedUp.unit * TEHER[type];
		return usedUp;
	}
}catch(e) {console.error(e); debug('buildArmy', e);}}
function extendArmy(oArmy, falukoord, slowestUnit) {try{
	/*  oArmy:
		units: {spear: 1, sword: 2, ..., pop: 3},
		teher: 322000
	 */
	switch(slowestUnit) {
		case 'heavy': tryAdd('heavy'); tryAdd('light'); tryAdd('marcher'); break;
		case 'light': tryAdd('light'); tryAdd('marcher'); break;
		case 'sword': tryAdd('sword'); tryAdd('axe'); tryAdd('spear'); tryAdd('archer'); break;
		case 'spear': tryAdd('axe'); tryAdd('spear'); tryAdd('archer'); break;
	}
	return oArmy;

	function tryAdd(unitType) {
		if (!SZEM4_FARM.DOMINFO_FROM[falukoord].isUnits[unitType]) return;
		if (!oArmy.units[unitType]) oArmy.units[unitType] = 0;
		while (oArmy.units.pop < SZEM4_FARM.OPTIONS.minsereg) {
			if (SZEM4_FARM.DOMINFO_FROM[falukoord].noOfUnits[unitType] < oArmy.units[unitType] + 1) {
				SZEM4_FARM.DOMINFO_FROM[falukoord].noOfUnits[unitType] = 0; //Hogy még 1x ne hozza fel, mert a minimumot se tudom elküldeni!
				break;
			}
			oArmy.units[unitType]++;
			oArmy.units.pop += TANYA[unitType];
			oArmy.teher += TEHER[unitType];
		}
	}
}catch(e){ console.error(e); debug('extendArmy', 'Error: '+e); return oArmy; }}

function getSlowestUnit(attacker) {try{
	// Get unit speed of the smallest available, but priorize horse
	// heavy > light,marcher > sword > spear,axe,archer
	const available_units = {};
	let isUnit = false;
	for (let i=0;i<UNITS.length;i++) {
		if (UNITS[i] !== 'spy' && attacker.isUnits[UNITS[i]] && attacker.noOfUnits[UNITS[i]] > 0) {
			available_units[UNITS[i]] = true;
			isUnit = true;
		}
	}
	if (available_units.heavy) return 'heavy';
	if (available_units.light || available_units.marcher) return 'light';
	if (available_units.sword) return 'sword';
	if (isUnit) return 'spear';
	return '';
}catch(e) { debug('getSlowestUnit','Nem megállapítható egységsebesség, kl-t feltételezek ' + e); return 'light';}}
function updateAvailableUnits(attacker, isError=false) {try{
	for (let i=0;i<UNITS.length;i++) {
		let allUnit = gameNum(FARM_REF, `#units_entry_all_${UNITS[i]}`, `${UNITS[i]}: elerheto mennyiseg`);
		let unitToSendString = gameEl(FARM_REF, `#unit_input_${UNITS[i]}`, `${UNITS[i]}: beviteli mezo`).value;
		if (unitToSendString == '') unitToSendString = 0;
		let unitToSend = isError ? 0 : parseInt(unitToSendString,10);
		attacker.noOfUnits[UNITS[i]] = allUnit - unitToSend;
	}
}catch(e) { console.error(e); debug('updateAvailableUnits', `Lépés: ${FARM_LEPES}, hiba: ${e}`);}}
function setNoUnits(attacker, unitType) {try{
	for (let i=0;i<UNITS.length;i++) {
		let unit = UNITS[i];
		if (unitType == 'troop' && (unit == 'spear' || unit == 'sword' || unit == 'axe' || unit == 'archer')) {
			attacker.noOfUnits[unit] = 0;
		}
		if (unitType == 'horse' && (unit == 'light' || unit == 'marcher' || unit == 'heavy')) {
			attacker.noOfUnits[unit] = 0;
		}
		if (unitType == 'all') {
			attacker.noOfUnits[unit] = 0;
		}
	}
}catch(e) { console.error(e); debug('setNoUnits', e);}}

function szem4_farmolo_1kereso(){try{/*Farm keresi párját :)*/
	// Nem pipálja a kémest az a baj
	var farmList = document.getElementById("farm_hova").rows;
	if (Object.keys(SZEM4_FARM.DOMINFO_FARMS) == 0 || Object.keys(SZEM4_FARM.DOMINFO_FROM) == 0) return "zero";
	var verszem = false;
	const targetIdo = SZEM4_FARM.OPTIONS.targetIdo;
	const maxWall = SZEM4_FARM.OPTIONS.maxfal;

	let bestPlan = { travelTime: -1 };
	for (var i=1;i<farmList.length;i++) {
		if (farmList[i].cells[0].style.backgroundColor=="red") continue;
		var farmCoord = farmList[i].cells[0].textContent;
		if (SZEM4_FARM.DOMINFO_FARMS[farmCoord].buildings.wall > maxWall) continue;
		let prodHour = SZEM4_FARM.DOMINFO_FARMS[farmCoord].prodHour;
		let hatarszam = prodHour * (targetIdo / 60);
		var nyers_VIJE = SZEM4_FARM.DOMINFO_FARMS[farmCoord].nyers;
		if (nyers_VIJE > 0) nyers_VIJE -= getAllResFromVIJE(farmCoord);
		verszem = false;
		if (nyers_VIJE > (hatarszam * 4)) verszem = true;
		
		/*Farm vizsgálat (a[i]. sor), legközelebbi saját falu keresés hozzá (van e egyátalán (par.length==3?))*/
		let attackPlan = planAttack(farmList[i], nyers_VIJE, verszem ? -1 : bestPlan.travelTime, hatarszam);
		
		if (attackPlan.travelTime && (bestPlan.travelTime == -1 || attackPlan.travelTime < bestPlan.travelTime)) {
			bestPlan = JSON.parse(JSON.stringify(attackPlan));
		}
		if (verszem && attackPlan.travelTime) {
			bestPlan = JSON.parse(JSON.stringify(attackPlan));
			break;
		}
	}
	return bestPlan;
}catch(e){debug('szem4_farmolo_1kereso()',e); return 'ERROR';}}

function szem4_farmolo_2illeszto(bestPlan){try{/*FIXME: határszám alapján számolódjon a min. sereg*/
	TamadUpdt(FARM_REF); // reports its own failures
	const allOptions = document.getElementById('farmolo_options');
	const minSereg = parseInt(allOptions.minsereg.value,10);
	const kemPerMin = parseInt(allOptions.kemperc.value,10);
	const kemdb = parseInt(allOptions.kemdb.value,10);
	const raktarLimit = parseInt(allOptions.raktar.value,10);
	const targetIdo = parseInt(allOptions.targetIdo.value,10);
	const hatarszam = SZEM4_FARM.DOMINFO_FARMS[bestPlan.farmVill].prodHour * (targetIdo / 60);
	const C_form = FARM_REF.document.forms["units"];
	
	/* A target left over from the previous cycle sits in #place_target as a
	   .village-item card. The game then honours that card rather than the x/y
	   fields, and submitting produces "Kérünk adj meg célfalut" over a form
	   that looks correctly filled in -- the farm engine stops dead without
	   raising anything.

	   This checked SZEM's own page instead of the game's, so it never fired.
	   Rather than guess which control dismisses the card, reopen the rally
	   point: a freshly loaded #place_target holds only the empty autocomplete
	   input, and returning 'semmi' is the existing replan path, so the engine
	   simply picks a target again next cycle. */
	if (FARM_REF.document.querySelector('#place_target .village-item')) {
		debug('szem4_farmolo_2illeszto', 'Maradék célpont a gyülekezőhelyen, újranyitom az oldalt.');
		FARM_REF = windowOpener('farm', gameUrl({ screen: 'place', mode: null, group: null, page: null }), AZON+"_Farmolo");
		return 'semmi';
	}

	if (!C_form) {
		if (FARM_REF.document.getElementById('command-data-form')) {
			C_form=FARM_REF.document.getElementById('command-data-form');
			debug('szem4_farmolo_2illeszto', 'ROllback-to-IDForm');
		} else {
			throw "Nincs gyülekezőhely?";
		}
	}
	if (C_form["input"].value == undefined) {
		throw "Nem töltött be az oldal? " + C_form["input"].innerHTML;
	}
	
	updateAvailableUnits(SZEM4_FARM.DOMINFO_FROM[bestPlan.fromVill]);
	//attackerRow, priorityType, teher
	const plannedArmy = buildArmy(SZEM4_FARM.DOMINFO_FROM[bestPlan.fromVill], bestPlan.slowestUnit, bestPlan.nyersToFarm);
	if (bestPlan.isMax && plannedArmy.units.pop < minSereg) {
		extendArmy(plannedArmy, bestPlan.fromVill, bestPlan.slowestUnit);
	}
	if (!plannedArmy.units || plannedArmy.units.pop < minSereg || (plannedArmy.teher + 50) < hatarszam) {
		if (bestPlan.isMax && plannedArmy.teher < hatarszam) {
			// Ha olyan messzi van a falu, amire a megbízhatóságnyi szintet is el tudná hozni, de olyan kevés ott a sereg, hogy az még a határszámnyi elhozásra se elég.
			for (let unitType in plannedArmy.units) {
				if (unitType === 'pop') continue;
				SZEM4_FARM.DOMINFO_FROM[bestPlan.fromVill].noOfUnits[unitType] = 0;
			}
		}
		console.info(new Date().toLocaleString(), `Invalid config, replanning. minSereg: ${minSereg}, isMax? ${bestPlan.isMax} hatarszam: ${hatarszam}, prodHour: ${SZEM4_FARM.DOMINFO_FARMS[bestPlan.farmVill].prodHour}`,
			`Config was: ${JSON.stringify(bestPlan)}`,
			`Config expected: ${JSON.stringify(plannedArmy)}`);
		return 'semmi'; // Nem jó, újratervezés
	}
	bestPlan.nyersToFarm = plannedArmy.teher;

	Object.entries(plannedArmy.units).forEach(entry => {
		const [unit, unitToSend] = entry;
		if (unit !== 'pop') {
			C_form[unit].value = unitToSend;
		}
	});

	// KÉMEK
	C_form.spy.value=0;
	let kemToSend = 0;
	if (SZEM4_FARM.DOMINFO_FROM[bestPlan.fromVill].isUnits.spy) {
		var ut_perc = distCalc(bestPlan.fromVill.split('|'), bestPlan.farmVill.split('|')) * E_SEB[bestPlan.slowestUnit] * (1/SPEED)*(1/UNIT_S);
		var erk = getServerTime();
		erk=erk.setSeconds(erk.getSeconds() + (ut_perc *60));
		
		if (!SZEM4_FARM.ALL_SPY_MOVEMENTS[bestPlan.farmVill] || (erk - SZEM4_FARM.ALL_SPY_MOVEMENTS[bestPlan.farmVill]) > (kemPerMin * 60000)) {
			let kemMezo = gameEl(FARM_REF, '#unit_input_spy', 'kem beviteli mezo');
			let kemElerheto = numFrom(kemMezo.parentNode.children[2], 'elerheto kemek szama');
			kemToSend = (kemElerheto >= kemdb ? kemdb : 0)
			C_form.spy.value= kemToSend;
		}
	}

	/*Raktár túltelített?*/
	var nyersarany=((FARM_REF.game_data.village.wood+FARM_REF.game_data.village.stone+FARM_REF.game_data.village.iron) / 3) / FARM_REF.game_data.village.storage_max;
	if (Math.round(nyersarany*100)>parseInt(raktarLimit)) {
		setNoUnits(SZEM4_FARM.DOMINFO_FROM[bestPlan.fromVill], 'all');
		naplo('Farmoló', 'Raktár túltelített ebben a faluban: ' + bestPlan.fromVill + '. (' + Math.round(nyersarany*100) + '% > ' + raktarLimit + '%)');
		return "semmi";
	}

	C_form.x.value=bestPlan.farmVill.split("|")[0];
	C_form.y.value=bestPlan.farmVill.split("|")[1];
	
	updateAvailableUnits(SZEM4_FARM.DOMINFO_FROM[bestPlan.fromVill]);
	C_form.attack.click();

	bestPlan.units = JSON.parse(JSON.stringify(plannedArmy.units));
	return {
		plannedArmy: bestPlan,
		kem: kemToSend
	};
	//return [resultInfo.requiredNyers,ezt+'',adatok[2],adatok[3],slowestUnit,kek,resultInfo.debugzsak]; /*nyers_maradt;all/gyalog/semmi;honnan;hova;speed_slowest;kém ment e;teherbírás*/
}catch(e){debug("Illeszto()",e);FARM_LEPES=0;return "";}}

function szem4_farmolo_3egyeztet(adatok){try{
	var farm_helye=document.getElementById("farm_hova").rows;
	for (var i=1;i<farm_helye.length;i++) {
		if (farm_helye[i].cells[0].textContent==adatok.plannedArmy.farmVill) {farm_helye=farm_helye[i]; break;}
	}
	
	/*Piros szöveg*/
	try {
		if (FARM_REF.document.getElementById("content_value").getElementsByTagName("div")[0].getAttribute("class")=="error_box") {
			naplo("Farmoló", `Hiba ${adatok.plannedArmy.farmVill} farmolásánál: ${FARM_REF.document.getElementById("content_value").getElementsByTagName("div")[0].textContent}. Tovább nem támadom`);
			farm_helye.cells[0].style.backgroundColor="red";
			SZEM4_FARM.DOMINFO_FARMS[adatok.plannedArmy.farmVill].szin.falu = 'red';
			if (FARM_REF.document.querySelector('.village-item')) {
				FARM_REF.document.querySelector('.village-item').click();
			}
			updateAvailableUnits(SZEM4_FARM.DOMINFO_FROM[adatok.plannedArmy.fromVill], true);
			return "ERROR";
		}
	}catch(e){ console.error('szem4_farmolo_3egyeztet - piros szöveg', e); }
	
	/*Játékos-e?*/	
	try{
		if (FARM_REF.document.getElementById("content_value").getElementsByTagName("table")[0].rows[2].cells[1].getElementsByTagName("a")[0].href.indexOf("info_player")>-1) {
			if (!farm_helye.cells[4].getElementsByTagName("input")[0].checked) {
				naplo("Farmoló", `Játékos ${maplink(adatok.plannedArmy.farmVill)} helyen: ${FARM_REF.document.getElementById("content_value").getElementsByTagName("table")[0].rows[2].cells[1].innerHTML.replace("href",'target="_BLANK" href')}. Tovább nem támadom`);
				FARM_REF = windowOpener('farm', gameUrl({ screen: 'place', mode: null, group: null, page: null }), AZON+"_Farmolo"); // Ki kell ütni a nézetből
				farm_helye.cells[0].style.backgroundColor="red";
				updateAvailableUnits(SZEM4_FARM.DOMINFO_FROM[adatok.plannedArmy.fromVill], true);
				return "ERROR";
			}
		}
	}catch(e){ /* Nem az... */ }

	/* TravelTime egyezik? */
	let timeFormatted = gameEl(FARM_REF, '#content_value .vis', 'megerosito tablazat').rows[2].cells[1].textContent;
	let writedTime = timeFormatted.split(':').map((a) => parseInt(a, 10));
	writedTime = writedTime[0] * 60 + writedTime[1] + (writedTime[2] / 60);
	if (Math.abs(writedTime - adatok.plannedArmy.travelTime) > 0.05) {
		debug('szem4_farmolo_3egyeztet', `A tervezett idő (${adatok.plannedArmy.travelTime} perc) nem egyezik a küldendő idővel: ${timeFormatted}.`);
		return "ERROR";
	}

	/* Teherbírás egyezik? */
	// try{
	// 	var a = FARM_REF.document.getElementById("content_value").getElementsByTagName("table")[0].rows;
	// 	a = parseInt(a[a.length-1].cells[0].textContent.replace(/[^0-9]+/g,""));
	// 	if (adatok.plannedArmy.nyersToFarm != a) debug("farm3","Valódi teherbírás nem egyezik a kiszámolttal. Hiba, ha nincs teherbírást módosító \"eszköz\".");
	// }catch(e){ console.error('szem4_farmolo_3egyeztet - teherbiras',e) }

	/* Lila háttér a bányákra: kém van útban, de még nincs felderített adat. */
	if (adatok.kem > 0 && farm_helye.cells[1].textContent == '') {
		const scoutColor = 'rgb(213, 188, 244)';
		farm_helye.cells[1].style.backgroundColor = scoutColor;
		SZEM4_FARM.DOMINFO_FARMS[adatok.plannedArmy.farmVill].szin.banya = scoutColor;
	}

	addCurrentMovementToList(gameEl(FARM_REF, '#command-data-form', 'parancs urlap'), adatok.plannedArmy.farmVill, farm_helye, adatok.plannedArmy.units);
	gameEl(FARM_REF, '#troop_confirm_submit', 'tamadas megerosito gomb').click();
	document.getElementById('cnc_farm_heartbeat').innerHTML = new Date().toLocaleString();
	const megbizhatosag = parseInt(document.getElementById('farmolo_options').megbizhatosag.value, 10);
	const prodHour = SZEM4_FARM.DOMINFO_FARMS[adatok.plannedArmy.farmVill].prodHour;
	if (adatok.plannedArmy.nyersToFarm > (prodHour * (megbizhatosag / 60) * 3)) {
		playSound(`farmolas_exp`, 'mp3');
	} else {
		playSound(`farmolas_${Math.floor(1 + Math.random() * (11 - 1 + 1))}`, 'mp3');
	}
	// return [nez,sarga,adatok[2],adatok[3]];
	/*Legyen e 3. lépés;sárga hátteres idő lesz?;honnan;---*/
}catch(e){debug("szem4_farmolo_3egyeztet()",e); FARM_LEPES=0;}}

function szem4_farmolo_motor(){
	var nexttime = 500;
	var isPihen = false;
	try {
	nexttime = parseInt(document.getElementById("farmolo_options").sebesseg_m.value,10);
	
	if (BOT||FARM_PAUSE||USER_ACTIVITY) { nexttime = 5000; } else {
	/*if (FARM_REF!="undefined" && FARM_REF.closed) FARM_LEPES=0;*/
	if (FARM_HIBA>10) {
		FARM_HIBA=0; FARM_GHIBA++; FARM_LEPES=0;
		if(FARM_GHIBA>3) {
			if (FARM_GHIBA>5) {
				naplo("Globál","Nincs internet? Folyamatos hiba farmolónál");
				nexttime = 60000;
				playSound("bot2");
			}
			FARM_REF.close();
		}
	}
	switch (FARM_LEPES) {
		case 0: /*Meg kell nézni mi lesz a célpont, +nyitni a HONNAN-t.*/
				PM1=szem4_farmolo_1kereso();
				if (PM1=="zero" || PM1=="ERROR") {nexttime=10000; break;} /* Ha nincs még tábla feltöltve */
				if (PM1.travelTime == -1) { // Nincs munka
						nexttime=parseInt(document.getElementById("farmolo_options").sebesseg_p.value,10);
						nexttime*=60000;
						isPihen = true;
						// Reset round
						for (let aUnit in SZEM4_FARM.DOMINFO_FROM) {
							Object.keys(SZEM4_FARM.DOMINFO_FROM[aUnit].noOfUnits).reduce((item, key) => {
								item[key] = 999;
								return item;
							}, SZEM4_FARM.DOMINFO_FROM[aUnit].noOfUnits);
						}

						try {
							if (MOBILE_MODE)
								FARM_REF.close();
							else
								FARM_REF.document.title = 'Szem4/farmoló';
						} catch(e) { /* the window may already be gone; nothing depends on this */ }
						break;
				}
				if (!isPageLoaded(FARM_REF, KTID[PM1.fromVill],"screen=place") ||
					FARM_REF.document.location.href.indexOf("try=confirm") > -1 ||
					(FARM_REF.document.location.href.includes("mode=") && !FARM_REF.document.location.href.includes('mode=command'))) {
						FARM_REF=windowOpener('farm', gameUrl({ village: KTID[PM1.fromVill], screen: 'place', mode: null, group: null, page: null }), AZON+"_Farmolo");
				}
				/*debug("Farmoló_ToStep1",PM1);*/
				FARM_LEPES=1;
				break;
		case 1: /*Gyül.helyen vagyunk, be kell illeszteni a megfelelő sereget, -nyers.*/
				if (isPageLoaded(FARM_REF,KTID[PM1.fromVill],"screen=place")) {
					FARM_REF.document.title = 'Szem4/farmoló';
					PM1=szem4_farmolo_2illeszto(PM1);
					FARM_HIBA=0; FARM_GHIBA=0;
					if (PM1 === 'semmi') 
						FARM_LEPES = 0;
					else
						FARM_LEPES = 2;
				} else {FARM_HIBA++;}
				break;
		case 2: /*Confirm: nem e jött piros szöveg, játékos e -> OK-ézás.*/ 
				if (!PM1.plannedArmy || !PM1.plannedArmy.fromVill) {
					FARM_LEPES = 0;
					debug('szem4_farmolo_motor', 'Érvénytelen állapot' + (typeof PM1 === 'object' ? JSON.parse(PM1) : PM1));
					break;
				}
				if (isPageLoaded(FARM_REF,KTID[PM1.plannedArmy.fromVill],"try=confirm")) {
					FARM_HIBA=0; FARM_GHIBA=0;
					PM1=szem4_farmolo_3egyeztet(PM1);
					if (PM1 === 'ERROR') FARM_LEPES = 0;
					FARM_LEPES = 0;
				} else {FARM_HIBA++;}
				break;
		default: FARM_LEPES=0;
	}}
}catch(e){debug("szem4_farmolo_motor()",e+" Lépés:"+FARM_LEPES);}

var inga=100/((Math.random()*40)+80);
nexttime=Math.round(nexttime*inga);
if (isPihen) {
	debug('Farmoló', `Farmoló pihenni megy ${Math.round(nexttime / 60000)} percre`);
	/* Announced from here rather than from the step that decided to rest,
	   because the jitter just above is what actually sets the wake-up time.
	   A listener lining itself up with the farm needs that final figure. */
	sendCustomEvent('farm_pihen', { restMs: nexttime });
}
try{
	worker.postMessage({'id': 'farm', 'time': nexttime});
}catch(e){debug('farm', 'Worker engine error: ' + e);setTimeout(function(){szem4_farmolo_motor();}, 3000);}}

init();
ujkieg_hang("Alaphangok","naplobejegyzes;bot2;farmolas");
ujkieg("farm","Farmoló",`<tr><td>
	<table class="vis" id="farm_opts" style="width:100%; margin-bottom: 50px;">
		<tr>
			<th colspan="2">Beállítások</th>
		</tr>
		<tr>
			<td colspan="2" style="text-align: center">
			<form id="farmolo_options">
			<table>
			<tr><td><div class="combo-cell"><div class="imgbox"><img src="${pic('mozdony.png')}"></div><strong>Szerelvények</strong></div></td>
			<td>
			Menetrend: <input name="targetIdo" value="30" onkeypress="validate(event)" type="text" size="2" onmouseover="sugo(this, 'SZEM arra fog törekedni, hogy minimum ennyi időközönként indítson támadást egy falura')">p - 
			<input name="megbizhatosag" value="60" onkeypress="validate(event)" type="text" size="2" onmouseover="sugo(this, 'Megbízhatóság. MAX ennyi ideig létrejött termelésért indul (plusz felderített nyers)')">p
			Max táv: <input name="maxtav_ora" type="text" size="2" value="4" onkeypress="validate(event)" onmouseover="sugo(this,'A max távolság, amin túl már nem küldök támadásokat')">óra <input name="maxtav_p" onkeypress="validate(event)" type="text" size="2" value="0" onmouseover="sugo(this,'A max távolság, amin túl már nem küldök támadásokat')">perc.
			</td></tr>

			<tr>
			<td><div class="combo-cell"><div class="imgbox">${picBuilding('wall')}</div><strong>Fal szint</strong></div></td>
			<td>Ha a fal &gt; <input type="text" size="3" name="maxfal" onkeypress="validate(event)" value="3" onmouseover="sugo(this,'Élesen nagyobb! 0 esetén a fallal rendelkezőeket nem támadja.')">, nem támadja</td>
			</tr>

			<tr><td><div class="combo-cell"><div class="imgbox"><img src="${pic('beallitasok.png')}"></div><strong>Alapértékek</strong></div></td>
			<td>
			Termelés/óra: <input name="termeles" onkeypress="validate(event)" type="text" size="5" value="800" onchange="updateDefaultProdHour()" onmouseover="sugo(this,'Ha nincs felderített bányaszint, úgy veszi ennyi nyers termelődik ott óránként')">				
			Min sereg/falu: <input name="minsereg" onkeypress="validate(event)" type="text" value="20" size="4" onmouseover="sugo(this,'Ennél kevesebb fő támadásonként nem indul. A szám tanyahely szerinti foglalásban értendő. Javasolt: Határszám 1/20-ad része')">
			Ha a raktár &gt;<input name="raktar" onkeypress="validate(event)" type="text" size="2" onmouseover="sugo(this,'Figyeli a raktár telítettségét, és ha a megadott % fölé emelkedik, nem indít támadást onnan. Telítettség össznyersanyag alapján számolva. Min: 20. Ne nézze: 100-nál több érték megadása esetén.')" value="90">%, nem foszt.
			</td></tr>

			<tr><td><div class="combo-cell"><div class="imgbox"><img src="/graphic/unit/unit_spy.png"></div><strong>Kémek</strong></div></td>
			<td>
			Kém/falu: <input name="kemdb" onkeypress="validate(event)" type="text" value="1" size="2" onmouseover="sugo(this,'A kémes támadásokkal ennyi kém fog menni')">
			Kényszerített? <input name="isforced" type="checkbox" onmouseover="sugo(this,'Kémek nélkül nem indít támadást, ha kéne küldenie az időlimit esetén. Kémeket annak ellenére is fog vinni, ha nincs bepipálva a kém egység')">
			Kém/perc: <input name="kemperc" type="text" value="60" onkeypress="validate(event)" size="3" onmouseover="sugo(this,'Max ekkora időközönként küld kémet falunként')">
			</td></tr>
			
			<tr><td><div class="combo-cell"><div class="imgbox"><img src="${pic('sebesseg.png')}"></div><strong>Sebesség</strong></div></td>
			<td>
			<input name="sebesseg_p" onkeypress="validate(event)" type="text" size="2" value="10" onmouseover="sugo(this,'Ha a farmoló nem talál több feladatot magának megáll, ennyi időre. Érték lehet: 1-300. Javasolt érték: 15 perc')">perc /
						<input name="sebesseg_m" onkeypress="validate(event)" type="text" size="3" value="900" onmouseover="sugo(this,'Egyes utasítások/lapbetöltődések ennyi időközönként hajtódnak végre. Érték lehet: 200-6000. Javasolt: gépi: 500ms, emberi: 3000.')">ms.
			</td></tr></table>
			</form>
			</td>
		</tr>
		<tr>
			<th>Farmoló falu hozzáadása</th>
			<th>Farmolandó falu hozzáadása</th>
		</tr><tr>
			<td style="width:48%;" onmouseover="sugo(this,'Adj meg koordinátákat, melyek a te faluid és farmolni szeretnél velük. A koordináták elválasztása bármivel történhet.')">
				Koordináták: <input type="text" size="45" id="add_farmolo_faluk" placeholder="111|111, 222|222, ...">
				<input type="button" value="Hozzáad" onclick="add_farmolo()">
			</td>
			<td style="width:52%;" onmouseover="sugo(this,'Adj meg koordinátákat, amelyek farmok, és farmolni szeretnéd. A koordináták elválasztása bármivel történhet.')">
				Koordináták: <input type="text" size="45" id="add_farmolando_faluk" placeholder="111|111, 222|222, ...">
				<input type="button" value="Hozzáad" onclick="add_farmolando()">
			</td>
		</tr><tr>
			<td onmouseover="sugo(this,'A felvivendő falukból ezeket az egységeket használhatja SZEM IV farmolás céljából. Később módosítható.')" id="add_farmolo_egysegek" style="vertical-align:middle;">
				Mivel? ${rovidit("egysegek")}
			</td>
			<td>
			</td>
		</tr><tr>
			<td colspan="2" class="nopadding_td" onmouseover="sugo(this, 'Farmoló által küldött utolsó támadás idejét látod itt. Ha a szívre kattintasz, újraéleszted/feléleszted a farmolót a pihenésből.')">
				<div class="heartbeat_wrapper">
					<img src="${pic("heart.png")}" class="heartbeat_icon" onclick="restartKieg('farm')">
					<span id="cnc_farm_heartbeat">---</span>
				</div>
			</td>
		</tr>
	</table>
	<div class="szem4_farmolo_datatable_wrapper">
		<table class="vis" id="farm_honnan" style="vertical-align:top; display: inline-block;"><tr>
			<th width="55px" onmouseover="sugo(this,'Ezen falukból farmolsz. Dupla klikk az érintett sor koordinátájára=sor törlése.<br>Rendezhető')" style="cursor: pointer;" onclick='rendez("szoveg",false,this,"farm_honnan",0)'>Honnan</th>
			<th onmouseover="sugo(this,'Ezen egységeket használja fel SZEM a farmoláshoz. Bármikor módosítható. <br>Pipa: egy cellán végrehajtott (duplaklikkes) művelet minden látható falura érvényes lesz.')" style="height: 20px; min-width: 100px">
				Mivel?
				<span style="position:absolute;right: 7px;top: 3px;display: flex;vertical-align: middle;align-items: center;">
					<img src="${pic("search.png")}" alt="?" title="Szűrés falukra..." style="width:15px;height:15px; cursor: pointer;" onclick="szem4_farmolo_csoport('honnan')">
					<input type="checkbox" id="farm_multi_honnan" onmouseover="sugo(this,'Ha bepipálod, akkor egy cellán végzett dupla klikkes művelet minden sorra érvényes lesz az adott oszlopba (tehát minden falura), ami jelenleg látszik. Légy óvatos!')">
				</span>
			</th>
		</tr></table>\
		<table class="vis" id="farm_hova" style="vertical-align:top; display: inline-block;"><tr>
			<th onmouseover="sugo(this,'Ezen falukat farmolod. A háttérszín jelöli a jelentés színét: alapértelmezett=zöld jelik/nincs felderítve. Sárga=veszteség volt a falun. Piros: a támadás besült, nem megy rá több támadás.<br>Dupla klikk a koordira: a háttérszín alapértelmezettre állítása.<br>Rendezhető')" style="cursor: pointer;" onclick='rendez("szoveg",false,this,"farm_hova",0)'>Hova</th>
			<th onmouseover="sugo(this,'Felderített bányaszintek, ha van (fa, agyag, vas). Lila háttér: már megy oda kém, az adatok a jelentés megérkezésekor maguktól kitöltődnek.<br>Dupla klikk=az érintett sor törlése')">Bányák</th>
			<th onmouseover="sugo(this,'Fal szintje. A 0-nál kisebb számok nem hibák: ha nincs fal, a falu további jelei is beszámítanak (-1 ha nincs barakk, -1 ha a főhadiszállás 2. szintű, -2 ha 1. szintű). Minél kisebb a szám, annál védtelenebb a falu, így rendezéskor a leggyengébbek kerülnek előre.<br>Szimpla klikk: Katapultozó scriptet megtanítja az adott falu épületszintjeire. Dupla klikk=háttér csere (csak megjelölésként). 2 féle lehet: a zöld háttér a falszint változására eltűnik, a kék keret viszont csak manuálisan törölhető.<br>Rendezhető.')" onclick='rendez("szam",false,this,"farm_hova",2)' style="cursor: pointer;">Fal</th>
			<th onmouseover="sugo(this,'Számítások szerint ennyi nyers van az érintett faluba. Dupla klikk=érték módosítása.<br>Rendezhető.')" onclick='rendez("szam",false,this,"farm_hova",3)' style="cursor: pointer;">Nyers</th>
			<th onmouseover="sugo(this,'Játékos e? Ha játékost szeretnél támadni, pipáld be a falut mint játékos uralta, így támadni fogja. Ellenben piros hátteret kap a falu. (WIP: Nem működik/nem ismer fake-limitet, csupán engedi támadni!)')">J?</th>
			<th onmouseover="sugo(this,'Támadásokat tudod itt nyomon követni szerelvények formájában, melyek a támadási algoritmus alapjait képzik<br><br>Pipa: egy cellán végrehajtott (duplaklikkes) művelet minden látható falura érvényes lesz.')" style="height: 20px; vertical-align:middle;">
				Szerelvények
				<span style="position:absolute;right: 7px;top: 3px;display: flex;vertical-align: middle;align-items: center;">
					<img src="${pic("search.png")}" alt="?" title="Szűrés falukra..." style="width:15px;height:15px;" onclick="szem4_farmolo_csoport('hova')">
					<input type="checkbox" id="farm_multi_hova">
				</span>
			</th>
			<th onmouseover="sugo(this,'A legközelebbi farmoló faludtól mért távolság, mezőben.<br>Rendezhető: így a legközelebbi célpontok kerülnek előre.')" style="cursor: pointer;" onclick='rendez("tav",false,this,"farm_hova",6)'>Táv</th>
		</tr></table>
</div></p></td></tr>`);

var FARM_LEPES=0, FARM_REF, FARM_HIBA=0, FARM_GHIBA=0,
	BOT=false,
	FARMOLO_TIMER,
	SZEM4_FARM = defaultFarmState(),
	PM1, FARM_PAUSE=true;
szem4_farmolo_motor();

/* --------------------- JELENTÉS ELEMZŐ ----------------------- */
function readUpVijeOpts() {
	document.querySelectorAll('#vije_opts input').forEach(el => {
		if (el.type == 'text') {
			SZEM4_VIJE.i18ns[el.name] = el.value;
		} else if (el.type == 'checkbox') {
			SZEM4_VIJE.i18ns[el.name] = el.checked;
		}
	});
}
function rebuildDOM_VIJE() {
	document.querySelectorAll('#vije_opts input').forEach(el => {
		if (SZEM4_VIJE.i18ns[el.name] == undefined) return;
		if (el.type == 'text') {
			el.value = SZEM4_VIJE.i18ns[el.name];
		} else if (el.type == 'checkbox') {
			el.checked = SZEM4_VIJE.i18ns[el.name];
		}
	});
}
/* ---- pihenés szinkron -------------------------------------------------
   The farm engine announces its rest periods (farm_pihen). With this option
   on, VIJE sits them out too instead of polling reports on its own schedule.
   Two engines taking turns opening game windows is both wasted requests and a
   steadier pattern than one engine that goes quiet.

   VIJE wakes before the farm does, so reports that landed during the rest are
   already analysed by the time the farm picks its next targets -- the loot
   figures it reads are current instead of one round stale. The head start is
   capped at half the rest, so a short rest still syncs to something. */
const VIJE_SYNC_ELORE_MS = 120000;

function isVijeSyncResting() {
	/* Written as a positive test so a NaN or undefined reads as 'not resting'. */
	if (!(VIJE_SYNC_REST_UNTIL > Date.now())) return false;
	/* Re-read the option on every tick instead of trusting the moment the rest
	   was armed: unticking it should wake VIJE now, not at the end of a rest it
	   no longer wants. */
	try {
		if (!document.getElementById("vije_opts").pihensync.checked) return false;
	} catch (e) { return false; } // interface not built yet -- nothing to sync with
	return true;
}

function VIJE_IntelliAnalyst_isRequired(koord, jelRow, jelDate) {
	jelDate.setSeconds(59);
	if (SZEM4_VIJE.ALL_VIJE_SAVED[koord] && SZEM4_VIJE.ALL_VIJE_SAVED[koord] > jelDate) return false;
	
	const isSpy = !!jelRow.querySelector('img[src*="spy"]');
	if (isSpy) return true;

	let nyers_VIJE = SZEM4_FARM.DOMINFO_FARMS[koord].nyers;
	if (nyers_VIJE > 0) nyers_VIJE -= getAllResFromVIJE(koord);
	if (nyers_VIJE > 100) return true;
	return false;
}
function szem4_vije_forgot() {
	SZEM4_VIJE.ELEMZETT = [];
	SZEM4_VIJE.ALL_VIJE_SAVED = {};
	alert2('Elemzett jelentések elfelejtve')
}
function szem4_VIJE_1kivalaszt(){try{
	/*Eredménye: jelentés azon (0=nincs meló);farm koord;jelentés SZÍNe;volt e checkbox-olt jeli*/
	TamadUpdt(VIJE_REF1); // reports its own failures
	VT = gameEl(VIJE_REF1, '#report_list', 'jelentes lista').rows;
	if (VT.length<3) return [0,0,"",false];
	var isAnalize=false;
	let szin = '';
	for (var i=VT.length-2;i>0;i--) {
		var reportId=VT[i].cells[1].getElementsByTagName("span")[0].getAttribute("data-id").replace("label_","");
		if (SZEM4_VIJE.ELEMZETT.includes(reportId)) continue;

		try {
			var koord = VT[i].cells[1].textContent.match(/[0-9]+(\|)[0-9]+/g);
			koord = koord[koord.length-1];
		} catch(e) { continue; }
		var eredm = VIJE_FarmElem(koord); /*0:létező farm-e,1:van-e már bánya derítve,2:farm_helye DOM row element*/
		if (eredm[0]==false) continue;

		/*+++IDŐ*/
		var d=getServerTime(VIJE_REF1); var d2=getServerTime(VIJE_REF1);
		(function convertDate() {
			var ido = VT[i].cells[2].textContent;
			var oraperc=ido.match(/[0-9]+:[0-9]+/g)[0];
			var nap=ido.replace(oraperc,"").match(/[0-9]+/g)[0];
			d.setMinutes(parseInt(oraperc.split(":")[1],10));
			d.setHours(parseInt(oraperc.split(":")[0],10));
			d.setDate(parseInt(nap,10));
		})();

		/* Régi jelentés? */
		if ((d2-d) > 10800000 || (d2-d) < 0) var regi=true; else var regi=false; /*3 óra*/
		if (regi) continue;

		/* Szín lekezelése */
		const farm_helye = eredm[2];
		szin = VT[i].cells[1].childNodes;
		for (var s=0;s<szin.length;s++) {
			if (szin[s].nodeName=="IMG") {
				szin=szin[s].src.split(".png")[0].split("/");
				szin=szin[szin.length-1];
				break;
			}
		}

		if (szin.includes("green")) {
			VT[i].cells[0].getElementsByTagName("input")[0].checked = true;
			farm_helye.cells[0].style.backgroundColor="#f4e4bc";
		}
		else if (szin.includes('yellow')) {
			farm_helye.cells[0].style.backgroundColor = 'yellow';
			SZEM4_FARM.DOMINFO_FARMS[koord].szin.falu = 'yellow';
		}
		else if (!szin.includes('blue') && farm_helye.cells[0].style.backgroundColor !== 'red') {
			farm_helye.cells[0].style.backgroundColor = 'red';
			SZEM4_FARM.DOMINFO_FARMS[koord].szin.falu = 'red';
			naplo('Jelentés Elemző', `${koord} farm veszélyesnek ítélve. Jelentésének színe ${szin}.`);
		}

		/* Van értelme elemezni? */
		if (!VIJE_IntelliAnalyst_isRequired(koord, VT[i].cells[1], d)) {
			SZEM4_VIJE.ELEMZETT.push(reportId);
			continue;
		} else {
			isAnalize=true;
			break;
		}
	}
	/*Ha nincs talált jeli --> nézd meg volt e checkboxolt, és ha igen, akkor törlés, majd pihenés */
	if (!isAnalize) {
		for (var i=VT.length-2;i>0;i--) {
			if (VT[i].cells[0].getElementsByTagName("input")[0].checked) {
				szem4_VIJE_3torol();
				return [0,0,"",true];
			}
		}
		return [0,0,"",false];
	}
	
	// reportId, farm koord, jelentés színe, ???, régi
	return [reportId,koord,szin,false,regi];

	function VIJE_FarmElem(koord){try{
		var farm_helye=document.getElementById("farm_hova").rows;
		var isExists=false;
		for (var i=1;i<farm_helye.length;i++) {
			if (farm_helye[i].cells[0].textContent==koord) {
				isExists=true;
				farm_helye=farm_helye[i];
				break;
			}
		}
		if (!isExists) return [false,false,0];
		
		var banyaVanE=true;
		if (farm_helye.cells[1].textContent=="") banyaVanE=false;
		
		return [isExists, banyaVanE, farm_helye, true];
	}catch(e){debug("VIJE1_farmelem","Hiba: "+e);}}
}catch(e){debug("VIJE1","Hiba: "+e);return [0,0,"",false];}}

function VIJE_adatbeir(koord,nyers,banya,fal,szin, hungarianDate){try{
	// célpont, 0, '', '', szín, jelidate
	var farm_helye=document.getElementById("farm_hova").rows;
	for (var i=1;i<farm_helye.length;i++) {
		if (farm_helye[i].cells[0].textContent==koord) {farm_helye=farm_helye[i]; break;}
	}
	if (banya!=='') {
		farm_helye.cells[1].innerHTML=banya;
		SZEM4_FARM.DOMINFO_FARMS[koord].prodHour = getProdHour(banya.join(','));
		farm_helye.cells[1].style.backgroundColor = '';
		SZEM4_FARM.DOMINFO_FARMS[koord].szin.banya = '';
	}
	if (szin == 'SEREG') {
		farm_helye.cells[0].style.backgroundColor = 'red';
		SZEM4_FARM.DOMINFO_FARMS[koord].szin = SZEM4_FARM.DOMINFO_FARMS[koord].szin || {};
		SZEM4_FARM.DOMINFO_FARMS[koord].szin.falu = 'red';
		naplo('VIJE', `${koord} -- Sereg a faluban!`);
	}
	if (fal !== '') {
		if (parseInt(farm_helye.cells[2].textContent.trim(), 10) !== parseInt(fal, 10)) {
			farm_helye.cells[2].style.backgroundColor = '';
			SZEM4_FARM.DOMINFO_FARMS[koord].szin.fal = '';
		}
		farm_helye.cells[2].innerHTML = `
		<span class="tooltip_hover">
			${fal}
			<span class="tooltip_text"></span>
		</span>`;
		SZEM4_FARM.DOMINFO_FARMS[koord].buildings.wall = fal;
	}
	if (nyers !== '') { // Ha van adatunk a nyersanyagról...
		farm_helye.cells[3].innerHTML = nyers;
		SZEM4_FARM.DOMINFO_FARMS[koord].nyers = nyers;
		if (!SZEM4_VIJE.ALL_VIJE_SAVED[koord] || SZEM4_VIJE.ALL_VIJE_SAVED[koord] < hungarianDate)
			SZEM4_VIJE.ALL_VIJE_SAVED[koord] = hungarianDate;
	}
	// Mockolt támadás beillesztése ha nem regisztrált támadásról jött jelentés
	var allAttack = SZEM4_FARM.ALL_UNIT_MOVEMENT[koord];
	if (!allAttack) SZEM4_FARM.ALL_UNIT_MOVEMENT[koord] = [[10000, hungarianDate, 0]];
	else {
		// debug('VIJE_adatbeir', `+Mock add: ${JSON.stringify(allAttack)} --`);
		var smallestDifference = null;
		SZEM4_FARM.ALL_UNIT_MOVEMENT[koord].forEach(arr => {
			var difference = Math.abs(arr[1] - hungarianDate);
			if (!smallestDifference || difference < smallestDifference) {
				smallestDifference = difference;
			}
		});
		if (smallestDifference > 60000) SZEM4_FARM.ALL_UNIT_MOVEMENT[koord].push([10000, hungarianDate, 0]); // FIXME: Ne 10k legyen már hanem MAX_megbízhatóság
		// debug('VIJE_adatbeir', `Mock added: ${JSON.stringify(allAttack)}`);
	}
	drawWagons(koord);
}catch(e){debug("VIJE_adatbeir","Hiba: "+e);}}
function getSpyResourceCell(doc) {
	var spyTable = doc.getElementById('attack_spy_resources');
	if (!spyTable) return null;
	for (var i = 0; i < spyTable.rows.length; i++) {
		var row = spyTable.rows[i];
		if (!row.cells || row.cells.length < 2) continue;
		var valueCell = row.cells[1];
		if (valueCell.querySelector('.farm_icon')) continue;
		if (valueCell.querySelector('.icon.header.wood, .icon.header.stone, .icon.header.iron')) return valueCell;
	}
	return null;
}
function getSpyBuildingLevels(doc) {
	const spyLevels = {
		main: 1,
		barracks: 0,
		stable: 0,
		garage: 0,
		smith: 0,
		market: 0,
		wood: 0,
		stone: 0,
		iron: 0,
		farm: 0,
		wall: 0
	};

	var buildingDataInput = doc.getElementById('attack_spy_building_data');
	if (buildingDataInput && buildingDataInput.value) {
		try {
			var buildingData = JSON.parse(buildingDataInput.value);
			for (var i = 0; i < buildingData.length; i++) {
				var building = buildingData[i];
				if (!(building.id in spyLevels)) continue;
				spyLevels[building.id] = parseInt(building.level, 10);
			}
			return spyLevels;
		} catch (e) {
			debug('getSpyBuildingLevels', 'JSON parse error: ' + e);
		}
	}

	if (!doc.getElementById('attack_spy_buildings_left') || !doc.getElementById('attack_spy_buildings_right')) return null;

	var i18nBuildings = document.getElementById('vije_opts');
	var spyBuildingRows_left = doc.getElementById('attack_spy_buildings_left').rows;
	var spyBuildingRows_right = doc.getElementById('attack_spy_buildings_right').rows;
	for (var rowNo = 1; rowNo < spyBuildingRows_left.length; rowNo++) {
		let buildingName_l = spyBuildingRows_left[rowNo].cells[0].textContent.toUpperCase().trim();
		let buildingName_r = spyBuildingRows_right[rowNo].cells[0].textContent.toUpperCase().trim();
		for (const key in spyLevels) {
			if (buildingName_l.includes(i18nBuildings[key].value.toUpperCase())) spyLevels[key] = parseInt(spyBuildingRows_left[rowNo].cells[1].textContent,10);
			if (buildingName_r.includes(i18nBuildings[key].value.toUpperCase())) spyLevels[key] = parseInt(spyBuildingRows_right[rowNo].cells[1].textContent,10);
		}
	}
	return spyLevels;
}
function szem4_VIJE_2elemzes(adatok){try{
	/*Adatok: [0]jelentés azon;[1]célpont koord;[2]jelentés SZÍNe;[3]volt e checkbox-olt jeli;[4]régi jeli e? (igen->nincs nyerselem)*/
	var nyersossz=0;
	var isOld = false;
	var reportTable=gameEl(VIJE_REF2, '#attack_info_att', 'jelentes fejlec').parentNode;
	while (reportTable.nodeName != 'TABLE') {
		reportTable = reportTable.parentNode;
	}
	var hungarianDate = reportTable.rows[1].cells[1].innerText;
	var defUnits = VIJE_REF2.document.getElementById('attack_info_def_units');
	if (defUnits && defUnits.textContent.match(/[1-9]+/g)) adatok[2] = 'SEREG';
	hungarianDate = new Date(Date.parse(hungarianDate.replace(/jan\./g, "Jan").replace(/febr?\./g, "Feb").replace(/márc\./g, "Mar").replace(/ápr\./g, "Apr").replace(/máj\./g, "May").replace(/jún\./g, "Jun").replace(/júl\./g, "Jul").replace(/aug\./g, "Aug").replace(/szept\./g, "Sep").replace(/okt\./g, "Oct").replace(/nov\./g, "Nov").replace(/dec\./g, "Dec")));
	hungarianDate = hungarianDate.getTime();
	if (SZEM4_VIJE.ALL_VIJE_SAVED[adatok[1]] >= hungarianDate) isOld = true;
	var spyResourcesCell = getSpyResourceCell(VIJE_REF2.document);
	if (!isOld && VIJE_REF2.document.querySelector('#attack_spy_resources') !== null) {
		var x = spyResourcesCell;

		if (adatok[4]) { var nyersossz=''; debug("VIJE2","Nem kell elemezni (régi)"); } else {
			try{
				if (x && /\d/.test(x.textContent)) {
					var nyers=x.textContent.replace(/\./g,"").match(/[0-9]+/g); 
					var nyersossz=0;
					for (var i=0;i<nyers.length;i++) nyersossz+=parseInt(nyers[i],10);
				} else {
					nyersossz=0;
				}
			}catch(e){var nyersossz=0; debug("VIJE","<a href='"+VIJE_REF2.document.location+"' target='_BLANK'>"+adatok[0]+"</a> ID-jű jelentés nem szokványos, talált nyers 0-ra állítva. Hiba: "+e);}
		}
	
		// Épületek
			var spyLevels = getSpyBuildingLevels(VIJE_REF2.document);
		if (spyLevels) {
			SZEM4_FARM.DOMINFO_FARMS[adatok[1]].buildings = JSON.parse(JSON.stringify(spyLevels));
			if (spyLevels.wall === 0) {
				if (spyLevels.barracks === 0) {
					spyLevels.wall--;
					if (spyLevels.main === 2) spyLevels.wall--;
					if (spyLevels.main === 1) spyLevels.wall-=2;
				}
			}
			var banyak = [spyLevels.wood, spyLevels.stone, spyLevels.iron];
			var fal = spyLevels.wall;
		} else { /*Csak nyerset láttunk*/
			var banyak = '';
			var fal = '';
		}
		VIJE_adatbeir(adatok[1],nyersossz,banyak,fal,adatok[2], hungarianDate);
	} else if (!isOld) {
		var atkTable = VIJE_REF2.document.getElementById('attack_results');
		var fosztogatas = atkTable?atkTable.rows[0].cells[2].innerText.split('/').map(item => parseInt(item,10)):0;
		var nyers = '';
		if (fosztogatas[0] + 5 < fosztogatas[1]) {
			nyers=0;
			//debug('debug/szem4_VIJE_2elemzes', `VIJE_adatbeir(${adatok[1],nyers},'','',${adatok[2]}, ${hungarianDate}`);
			VIJE_adatbeir(adatok[1],nyers,'','',adatok[2], hungarianDate);
		}
	}
	
	/*Tedd be az elemzettek listájába az ID-t*/
	SZEM4_VIJE.ELEMZETT.push(adatok[0]);
	if (SZEM4_VIJE.ELEMZETT.length > 600) {
		SZEM4_VIJE.ELEMZETT.splice(0, SZEM4_VIJE.ELEMZETT.length - 250);
	}
	
	VIJE2_HIBA=0; VIJE2_GHIBA=0;
	return true;
}catch(e){debug("VIJE2","Elemezhetetlen jelentés: "+adatok[0]+":"+adatok[1]+". Hiba: "+e); VIJE_adatbeir(adatok[1],nyersossz,"","",adatok[2]); VIJE2_HIBA++; VIJE_HIBA++; return false;}}

function szem4_VIJE_3torol(){try{
	if (document.getElementById("vije_opts").isdelete.checked) {
		try{VIJE_REF1.document.forms[0].del.click();}catch(e){VIJE_REF1.document.getElementsByName("del")[0].click();}
	}
}catch(e){debug("VIJE3","Hiba: "+e);return;}}

function szem4_VIJE_motor(){try{
	var nexttime=1500;
	var isSyncRest = false;
	if (VIJE_PAUSE) clearAttacks();
	if (BOT||VIJE_PAUSE||USER_ACTIVITY) {nexttime=5000;}
	else if (isVijeSyncResting()) {
		isSyncRest = true;
		nexttime = Math.max(VIJE_SYNC_REST_UNTIL - Date.now(), 1000);
	} else {
	if (VIJE_HIBA>10) {
		VIJE_HIBA=0; VIJE_GHIBA++; 
		if(VIJE_GHIBA>3) {
			if (VIJE_GHIBA>5) {
				naplo("Globál","Nincs internet? Folyamatos hiba a jelentés elemzőnél"); nexttime=60000; playSound("bot2");
			}
			debug('szem4_VIJE_motor', 'Jelentés elemzo hiba >3, ablak bezár/újranyit');
			VIJE_REF1.close();
		} VIJE_LEPES=0;
	}
	
	if (VIJE2_HIBA>6) {VIJE2_HIBA=0; VIJE2_GHIBA++; if(VIJE2_GHIBA>3) {if (VIJE2_GHIBA>5) naplo("Globál","Nincs internet? Folyamatos hiba a jelentés elemzőnél"); VIJE_REF2.close();} VIJE_LEPES=0;}
	if (!VIJE_REF1 || (VIJE_LEPES!=0 && VIJE_REF1.closed)) VIJE_LEPES=0;
	
	switch(VIJE_LEPES) {
		case 0: /*Támadói jelentések megnyitása*/
			if (document.getElementById("farm_hova").rows.length>1) {
			VIJE_REF1=windowOpener('vije', gameUrl({
				screen: 'report',
				mode: 'attack',
				group_id: game_data.player.premium ? -1 : null,
				view: null, group: null, page: null
			}), AZON+"_SZEM4VIJE_1");
			VIJE_LEPES=1;
			} else nexttime=10000;
			break;
		case 1: /*Megnyitandó jelentés kiválasztás(+bepipálás)*/
			if (isPageLoaded(VIJE_REF1,-1,"screen=report")) {
				VIJE_HIBA=0; VIJE_GHIBA=0;
				PM2=szem4_VIJE_1kivalaszt();
				if (PM2[0]===0) { // Nincs meló
					VIJE_LEPES=0;
					if (PM2[3] === false) {
						nexttime=120000;
						if (MOBILE_MODE) {
							VIJE_REF1.close();
							VIJE_REF2.close();
						}
					}
				} else {
					VIJE_REF2=windowOpener('vije2', gameUrl({
						screen: 'report',
						mode: 'attack',
						view: PM2[0],
						group_id: null, group: null, page: null
					}), AZON+"_SZEM4VIJE_2");
					VIJE_LEPES=2;
				}
				VIJE_REF1.document.title = 'Szem4/vije1';
			} else { VIJE_HIBA++; }
			break;
		case 2: /*Megnyitott jelentés elemzése*/
			if (isPageLoaded(VIJE_REF2,-1,PM2[0])) {
				clearAttacks();
				szem4_VIJE_2elemzes(PM2);
				if (PM2[3]) VIJE_LEPES=3; else VIJE_LEPES=1;
				VIJE_REF2.document.title = 'Szem4/vije2';
			} else { VIJE2_HIBA++;}
			break;
		case 3: /*bepipált jelentések törlése*/
			szem4_VIJE_3torol();
			VIJE_LEPES=0;
			if (PM2[0]===0) {
				nexttime=120000;
				if (MOBILE_MODE) {
					VIJE_REF1.close();
					VIJE_REF2.close();
				}
			}
			break;
		default: VIJE_LEPES=0;
	}}
}catch(e){debug("szem4_VIJE_motor()","ERROR: "+e+" Lépés:"+VIJE_LEPES);}
/* Skipped while resting in sync: that delay is a wake-up time aimed at the
   farm's own, and 1.25x of it would land after the farm is already moving. */
if (!isSyncRest) {
	var inga=100/((Math.random()*40)+80);
	nexttime=Math.round(nexttime*inga);
}
try{
	worker.postMessage({'id': 'vije', 'time': nexttime});
}catch(e){debug('vije', 'Worker engine error: ' + e);setTimeout(function(){szem4_VIJE_motor();}, 3000);}}
/*VIJE*/
ujkieg("vije","Jelentés Elemző",`<tr><td>
	A VIJE a Farmoló táblázatába dolgozik, itt csupán működési beállításokat módosíthatsz.
	<form id="vije_opts">
		<table class="vis szem4_vije_optsTable">
			<tr><td>${picBuilding('main')}</td><td>"Főhadiszállás" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="main" value="Főhadiszállás"></td></tr>
			<tr><td>${picBuilding('barracks')}</td><td>"Barakk" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="barracks" value="Barakk"></td></tr>
			<tr><td>${picBuilding('stable')}</td><td>"Istálló" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="stable" value="Istálló"></td></tr>
			<tr><td>${picBuilding('garage')}</td><td>"Műhely" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="garage" value="Műhely"></td></tr>
			<tr><td>${picBuilding('smith')}</td><td>"Kovácsműhely" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="smith" value="Kovácsműhely"></td></tr>
			<tr><td>${picBuilding('market')}</td><td>"Piac" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="market" value="Piac"></td></tr>
			<tr><td>${picBuilding('wood')}</td><td>"Fatelep" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="wood" value="Fatelep"></td></tr>
			<tr><td>${picBuilding('stone')}</td><td>"Agyagbánya" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="stone" value="Agyagbánya"></td></tr>
			<tr><td>${picBuilding('iron')}</td><td>"Vasbánya" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="iron" value="Vasbánya"></td></tr>
			<tr><td>${picBuilding('farm')}</td><td>"Tanya" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="farm" value="Tanya"></td></tr>
			<tr><td>${picBuilding('wall')}</td><td>"Fal" a szerver jelenlegi nyelvén</td><td><input type="text" size="15" name="wall" value="Fal"></td></tr>
		</table>
		<input type="checkbox" name="isdelete"> Zöld farmjelentések törlése?<br>
		<input type="checkbox" name="pihensync" onmouseover="sugo(this,'Amikor a Farmoló pihenni megy, a VIJE is pihen -- de pár perccel előbb ébred, hogy a friss jelentések már elemezve legyenek mire a Farmoló célt választ.<br>Ajánlott, ha a zöld farmjelentések törlése be van pipálva.')"> Pihenjen a Farmolóval együtt?<br>
		<button onclick="szem4_vije_forgot()" type="button">Jelentések újraelemzése/elfelejtése</button><br><br><br>
	</form>
	</td></tr>`);

var VIJE_PAUSE=true;
var VIJE_LEPES=0;
var VIJE_REF1; var VIJE_REF2;
var VIJE_HIBA=0; var VIJE_GHIBA=0;
var VIJE2_HIBA=0; var VIJE2_GHIBA=0;
var SZEM4_VIJE = defaultVijeState();
var VIJE_SYNC_REST_UNTIL = 0;
readUpVijeOpts();
var PM2;

document.addEventListener('farm_pihen', (ev) => {
	if (VIJE_PAUSE) return; // stopped by hand; leave it stopped
	try {
		if (!document.getElementById("vije_opts").pihensync.checked) return;
	} catch (e) { return; } // interface not built yet
	const restMs = ev.detail && ev.detail.restMs;
	if (!restMs || restMs <= 0) return;
	VIJE_SYNC_REST_UNTIL = Date.now() + Math.max(restMs - VIJE_SYNC_ELORE_MS, Math.round(restMs / 2));
	debug('Jelentés Elemző', `Farmolóval együtt pihen ${Math.round((VIJE_SYNC_REST_UNTIL - Date.now()) / 60000)} percre`);
});

szem4_VIJE_motor();

/*-----------------TÁMADÁS FIGYELŐ--------------------*/

function TamadUpdt(lap){try{
	var table=document.getElementById("idtamad_Bejovok");
	var d=getServerTime();
	var jelenlegi=parseInt(lap.game_data.player.incomings,10);
	var eddigi=0;
	if (table.rows.length>1) eddigi=parseInt(table.rows[1].cells[1].innerHTML,10);
	if (jelenlegi==eddigi) return;
	
	var row=table.insertRow(1);
	var cell1=row.insertCell(0);
	var cell2=row.insertCell(1);
	cell1.innerHTML=d;
	cell2.innerHTML=jelenlegi;
	
	if (jelenlegi>eddigi) playSound("bejovo"); /*replace: ATTACK SOUND!*/
	return;
}catch(e){debug("ID beir","Hiba: "+e);}}

ujkieg_hang("Bejövő támadások","bejovo");
ujkieg("idtamad","Bejövő támadások",'<tr><td align="center"><table class="vis" id="idtamad_Bejovok" style="vertical-align:top; display: inline-block;"><tr><th>Időpont</th><th>Támadások száma</th></tr></table> </td></tr>');

/*-----------------ÉPÍTŐ--------------------*/
function szem4_EPITO_perccsokkento(){try{
	var hely=document.getElementById("epit").getElementsByTagName("table")[1].rows;
	var patt=/[0-9]+\:[0-9]+/g;
	for (var i=1;i<hely.length;i++) {
		let currentCell = hely[i].cells[3];
		if (currentCell.textContent.search(patt)>-1) {
			let time = currentCell.textContent.match(patt)[0];
			time = time.split(':').map(a => parseInt(a,10));
			time = time[0] * 60 + time[1];
			time--;
			currentCell.textContent = currentCell.textContent.replace(patt, writeAllBuildTime(time, true));
		}
	}
}catch(e){debug("Építő_pcsökk",e); setTimeout("szem4_EPITO_perccsokkento()",60000);}}
function writeAllBuildTime(minutes, isDateOnly=false) {
	let sixty = 60;
	let hours = Math.floor(minutes / sixty);
	let mins = minutes % sixty;
	let toDate = hours.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
	if (isDateOnly) {
		return toDate;
	}
	return '<span class="writeOutDate">Hátralévő építési idő: ' + toDate + '</span>';
}

function szem4_EPITO_getlista(){try{
	var ret='<select>';
	var Z=document.getElementById("epit").getElementsByTagName("table")[0].rows;
	for (var i=1;i<Z.length;i++) {
		ret+='<option value="'+Z[i].cells[0].textContent+'">'+Z[i].cells[0].textContent+'</option> ';
	}
	ret+='</select>'; 
	return ret;
}catch(e){debug("Építő",e);}}

function szem4_EPITO_csopDelete(ezt){try{
	var name=ezt.innerHTML;
	if (!confirm("Biztos kitörlöd a "+name+" nevű csoportot?\nA csoportot használó faluk az Alapértelmezett csoportba fognak tartozni.")) return;
	sortorol(ezt,"");
	var bodyTable=document.getElementById("epit_lista").rows;
	for (var i=1;i<bodyTable.length;i++) {
		var selectedElement=bodyTable[i].cells[1].getElementsByTagName("select")[0];
		if (selectedElement.value==name) selectedElement.value=document.getElementById("epit").getElementsByTagName("table")[0].rows[1].cells[0].innerHTML;
	}
	bodyTable=document.getElementById("epit_ujfalu_adat").getElementsByTagName("option");
	for (var i=0;i<bodyTable.length;i++) {
		if (bodyTable[i].value==name) {
			document.getElementById("epit_ujfalu_adat").getElementsByTagName("select")[0].remove(i);
			break;
		}
	}
}catch(e){alert2("Hiba:\n"+e);}}

function szem4_EPITO_ujFalu() {
	try {
		var adat = document.getElementById("epit_ujfalu_adat");
		var faluCoord = adat.getElementsByTagName("input")[0].value;
		if (faluCoord == "" || faluCoord == null) return;
		faluCoord = faluCoord.match(/[0-9]{1,3}(\|)[0-9]{1,3}/g);
		var Z = document.getElementById("epit_lista");
		var str = "";
		var lista = szem4_EPITO_getlista();
		for (var i = 0; i < faluCoord.length; i++) {
			var vane = false;
			for (var j = 1; j < Z.rows.length; j++) {
				if (Z.rows[j].cells[0].textContent.includes(`(${faluCoord[i]})`)) vane = true;
			} if (vane) { str += "DUP:" + faluCoord[i] + ", "; continue; }
			if (!KTID[faluCoord[i]]) { str += "NL: " + faluCoord[i] + ", "; continue; }

			var ZR = Z.insertRow(-1);
			var ZC = ZR.insertCell(0); ZC.innerHTML = `${ID_TO_INFO[KTID[faluCoord[i]]].name} (${faluCoord[i]})`; ZC.setAttribute("ondblclick", "sortorol(this)");
			ZC = ZR.insertCell(1); ZC.innerHTML = lista; ZC.getElementsByTagName("select")[0].value = adat.getElementsByTagName("select")[0].value;
			ZC = ZR.insertCell(2); ZC.style.fontSize = "x-small"; var d = getServerTime(); ZC.innerHTML = d.toLocaleString(); ZC.setAttribute("ondblclick", "szem4_EPITO_most(this)");
			ZC = ZR.insertCell(3); ZC.innerHTML = "<i>Feldolgozás alatt...</i>" + ' <a href="' + gameUrl({ village: KTID[faluCoord[i]], screen: 'main', mode: null, group: null, page: null }) + '" target="_BLANK"><img alt="Nyit" title="Falu megnyitása" src="' + pic("link.png") + '"></a>';; ZC.setAttribute("ondblclick", 'szem4_EPITO_infoCell(this.parentNode,\'alap\',"")');
		}
		if (str != "") alert2("Dupla megadások/nem létező faluk kiszűrve: " + str);
		adat.getElementsByTagName("input")[0].value = "";
		return;
	} catch (e) { alert2("Új falu(k) felvételekori hiba:\n" + e); }
}

function szem4_EPITO_ujCsop(){try{
	var cs_nev=document.getElementById("epit_ujcsopnev").value.replace(/[;\._]/g,"").replace(/( )+/g," ");;
	if (cs_nev=="" || cs_nev==null) return;
	var Z=document.getElementById("epit").getElementsByTagName("table")[0];
	for (var i=1;i<Z.rows.length;i++) {
		if (Z.rows[i].cells[0].textContent==cs_nev) throw "Már létezik ilyen nevű csoport";
	}
	var ZR=Z.insertRow(-1);
	var ZC=ZR.insertCell(0); ZC.innerHTML=cs_nev; ZC.setAttribute("ondblclick","szem4_EPITO_csopDelete(this)");
		ZC=ZR.insertCell(1); ZC.innerHTML=Z.rows[1].cells[1].innerHTML; ZC.getElementsByTagName("input")[0].disabled=false;
	
	var Z=document.getElementById("epit_lista").rows;
	for (var i=1;i<Z.length;i++) {
		var Z2=Z[i].cells[1].getElementsByTagName("select")[0];
		var option=document.createElement("option");
		option.text=cs_nev;
		Z2.add(option);
	}
	Z2=document.getElementById("epit_ujfalu_adat").getElementsByTagName("select")[0];
	option=document.createElement("option");
	option.text=cs_nev;
	Z2.add(option);
	document.getElementById("epit_ujcsopnev").value="";
	return;
}catch(e){alert2("Új csoport felvételekori hiba:\n"+e);}}

function szem4_EPITO_cscheck(alma){try{
	var Z=alma.parentNode.getElementsByTagName("input")[0].value;
	Z=Z.split(";");
	
	var epuletek=new Array("main","barracks","stable","garage","church_f","church","smith","snob","place","statue","market","wood","stone","iron","farm","storage","hide","wall","MINES");
	var kapcsolok=new Array("ANY","FASTEST");
	for (var i=0;i<Z.length;i++) {
		var entry = parseBuildEntry(Z[i]);
		entry.modifiers.forEach(function(mod) {
			if (kapcsolok.indexOf(mod)===-1) throw "Ismeretlen kapcsoló: "+mod+"()";
		});
		/* Caught here rather than at build time: a stray comma parses to just the
		   first target and the rest is silently dropped, so the list would look
		   accepted while quietly building less than it says. */
		if (!entry.modifiers.length && Z[i].indexOf(",")>-1) throw "Vessző csak kapcsolón belül használható, pl. ANY(...): "+Z[i];
		entry.parts.forEach(function(part) {
			if (epuletek.indexOf(part[0])===-1) throw "Nincs ilyen épület: "+part[0];
			if (!(part[1]>0)) throw "Hiányzó vagy hibás épületszint: "+Z[i];
			if (part[1]>30) throw "Túl magas épületszint: "+Z[i];
		});
	}
	alert2("Minden OK");
}catch(e){alert2(`Hibás lista: [${i}]\n ${e}`);}}

function szem4_EPITO_most(objektum){try{
	var d=getServerTime();
	objektum.innerHTML=d.toLocaleString();
	return;
}catch(e){alert2("Hiba lépett fel:\n"+e);}}

function szem4_EPITO_csopToList(csoport){try{
	var Z=document.getElementById("epit").getElementsByTagName("table")[0].rows;
	for (var i=1;i<Z.length;i++) {
		if (Z[i].cells[0].textContent==csoport) return Z[i].cells[1].getElementsByTagName("input")[0].value;
	}
	return ";";
}catch(e){debug("epito_csopToList",e);}}

function szem4_EPITO_Wopen(){try{
	/*Eredmény: faluID, teljes építendő lista, pointer a sorra*/
	var TT=document.getElementById("epit_lista").rows;
	var now=getServerTime();
	for (var i=1;i<TT.length;i++) {
		var datum=new Date(TT[i].cells[2].textContent);
		if (datum<now) {
			var lista=szem4_EPITO_csopToList(TT[i].cells[1].getElementsByTagName("select")[0].value);
			let coord = TT[i].cells[0].textContent.trim().match(/\([0-9]+\|[0-9]+\)$/)[0].replace('(','').replace(')','');
			return [ KTID[coord], lista, TT[i] ];
		}
	}
	return [0,";"];
}catch(e){debug("Epito_Wopen",e);}}

function szem4_EPITO_addIdo(sor, perc){try{
	if (perc == "del") {
		document.getElementById("epit_lista").deleteRow(sor.rowIndex);
	} else {
		if (perc === 0) perc = 30;
		if (isNaN(perc)) perc = 5;
		var d=getServerTime();
		d.setSeconds(d.getMinutes() + (perc * 60));
		sor.cells[2].innerHTML=d.toLocaleString();
	}
}catch(e){debug("epito_addIdo",e); return false;}}

function szem4_EPITO_infoCell(sor,szin,info){try{
	if (szin=="alap") szin="#f4e4bc";
	if (szin=="blue") szin="#44F";
	if (szin=="red") setTimeout('playSound("kritikus_hiba")',2000);
	sor.cells[3].style.backgroundColor=szin;
	let coord = sor.cells[0].textContent.split(' ');
	coord = coord[coord.length-1].replace('(', '').replace(')','');
	sor.cells[3].innerHTML=info+' <a href="'+gameUrl({ village: KTID[coord], screen: 'main', mode: null, group: null, page: null })+'" target="_BLANK"><img alt="Nyit" title="Falu megnyitása" src="'+pic("link.png")+'"></a>';
	return;
}catch(e){debug("építő_infoCell",e);}}

function szem4_EPITO_getBuildLink(ref, type) {
	var row = ref.document.getElementById('main_buildrow_' + type);
	if (row.cells.length < 3) return false;
	var patt = new RegExp('main_buildlink_'+type+'_[0-9]+','g');
	var allItem = row.getElementsByTagName("*");
	for (var i=0;i<allItem.length;i++) {
		if (patt.test(allItem[i].id)) {
		return allItem[i];
		}
	}
}

/* Reads a building's cost from its row on the headquarters screen.

   The three copies this replaces each did parseInt(cell.match(/[0-9]+/g), 10).
   Costs are printed with thousands separators, so "1.100" matches as
   ["1","100"], which parseInt reads through the string "1,100" as 1. Every
   cost of 1000 or more came back as its leading digits, so the resource check
   below almost never fired: the builder believed it could afford anything,
   clicked build, found the button hidden, and reported an unknown error or a
   full queue instead of a shortage -- then retried on the wrong schedule.

   The report analyser already strips the separators before reading numbers;
   this simply does the same. */
function buildingCost(row) {
	function amount(index) {
		const cell = row.cells[index];
		if (!cell) return 0;
		const digits = cell.textContent.replace(/\./g, '').match(/[0-9]+/);
		return digits ? parseInt(digits[0], 10) : 0;
	}
	return { wood: amount(1), stone: amount(2), iron: amount(3), pop: amount(5) };
}

/* ---- build-order entries -----------------------------------------------
   An entry is either a plain "epulet szint" pair or modifiers wrapping one or
   more of them, comma separated: ANY(barracks 5, stable 5), ANY(MINES 25),
   ANY(FASTEST(MINES 25)). Modifiers nest, and each one is just a transform of
   the candidate list, so adding another means adding a case below. */
function splitBuildTarget(text) {
	const bits = text.trim().split(/\s+/);
	return [bits[0], parseInt(bits[1], 10)];
}
function parseBuildEntry(entry) {
	const modifiers = [];
	let text = entry.trim(), wrapped;
	while ((wrapped = text.match(/^([A-Z]+)\s*\((.*)\)$/))) {
		modifiers.push(wrapped[1]);
		text = wrapped[2].trim();
	}
	return { modifiers: modifiers, parts: text.split(',').map(splitBuildTarget) };
}

/* Build time is the fifth cell of a build row, written H:MM:SS. Read from the
   right so a longer D:H:MM:SS would still add up. A row without that cell is a
   building that cannot be raised any further -- the game replaces the whole
   row with "Epulet teljesen felepitve" -- so it sorts last, never first. */
function buildTimeOf(ref, id) {
	const row = ref.document.getElementById('main_buildrow_' + id);
	if (!row || !row.cells[4]) return Infinity;
	const bits = row.cells[4].textContent.match(/[0-9]+/g);
	if (!bits) return Infinity;
	const scale = [1, 60, 3600, 86400];
	let secs = 0;
	bits.reverse().forEach((n, i) => { if (i < scale.length) secs += parseInt(n, 10) * scale[i]; });
	return secs;
}

/* Each modifier reorders or narrows the candidate list; the pick is whatever
   ends up first. ANY keeps the list untouched when nothing is affordable, so
   the caller still lands on the old wait-or-insert-a-warehouse path. */
function applyBuildModifier(name, candidates, ref) {
	if (name === 'FASTEST') {
		return candidates.slice().sort((a, b) => {
			const ta = buildTimeOf(ref, a), tb = buildTimeOf(ref, b);
			return ta === tb ? 0 : (ta < tb ? -1 : 1); // never Infinity - Infinity
		});
	}
	if (name === 'ANY') {
		const affordable = candidates.filter(id => canAffordBuildNow(ref, id));
		return affordable.length ? affordable : candidates;
	}
	return candidates;
}

/* Every building an entry still wants, best-first. MINES keeps its original
   preference -- the lowest of the three pits, ties going wood, stone, iron --
   because sort() is stable and they are listed in that order. */
function buildCandidates(parts, lvls) {
	const out = [];
	const add = id => { if (out.indexOf(id) === -1) out.push(id); };
	parts.forEach(([id, level]) => {
		if (id === 'MINES') {
			['wood', 'stone', 'iron'].filter(m => lvls[m] < level)
				.sort((a, b) => lvls[a] - lvls[b]).forEach(add);
		} else if (lvls[id] < level) add(id);
	});
	return out;
}

/* Deliberately false for anything the warehouse or the farm cannot take yet:
   as one option among several those are worth stepping over, and if every
   option fails the caller falls back to the first, which still reaches the
   existing "insert a warehouse/farm" path. */
function canAffordBuildNow(ref, id) {
	const row = ref.document.getElementById('main_buildrow_' + id);
	if (!row) return false; // not available -- prerequisite missing
	/* A building at its maximum keeps a row but loses every cost cell, so its
	   cost reads as zero -- which would make it look cheaper than everything
	   else and win every comparison, then fail to click. */
	if (!row.querySelector('.btn.btn-build')) return false;
	const cost = buildingCost(row);
	const v = ref.game_data.village;
	if (Math.max(cost.wood, cost.stone, cost.iron) > v.storage_max) return false;
	if (cost.pop > (v.pop_max - v.pop)) return false;
	return v.wood >= cost.wood && v.stone >= cost.stone && v.iron >= cost.iron;
}

function szem4_EPITO_IntettiBuild(buildOrder){try{
	TamadUpdt(EPIT_REF); // reports its own failures
	var buildList=""; /*Current BuildingList IDs*/
	var allBuildTime=0; /*Ennyi perc építési idő, csak kiírás végett*/
	var firstBuildTime=0; /*Az első épület építési ideje*/
	var textTime;

	try {
		var buildQueue = EPIT_REF.document.getElementById("buildqueue");
		if (!buildQueue) throw 'No queue';
		var buildQueueRows=buildQueue.rows;
		for (var i=1;i<buildQueueRows.length;i++) {try{
			buildList+=buildQueueRows[i].cells[0].getElementsByTagName("img")[0].src.match(/[A-Za-z0-9]+\.(png)/g)[0].replace(/[0-9]+/g,"").replace(".png","");
			textTime=buildQueueRows[i].cells[1].textContent.split(":");
			allBuildTime+=parseInt(textTime[0])*60+parseInt(textTime[1])+(parseInt(textTime[2])/60);
			if (firstBuildTime==0) firstBuildTime=allBuildTime;
			buildList+=";";
		}catch(e){ debug('szem4_EPITO_IntettiBuild', `Az építési sor ${i}. sorát nem sikerült értelmezni, a hátralévő idő emiatt kevesebb lehet: ${e}`); }}

		allBuildTime = Math.round(allBuildTime);
		firstBuildTime = Math.ceil(firstBuildTime);

		if (isNaN(allBuildTime)) allBuildTime = 5;
		if (isNaN(firstBuildTime)) firstBuildTime = 5;
		if (firstBuildTime>180) firstBuildTime=180;
	}catch(e){var buildList=";"; var allBuildTime=0; var firstBuildTime=0;}
	
	if (buildList === '') buildList = ';';
	buildList=buildList.split(";");
	buildList.pop();
	if (buildList.length>4) {
		szem4_EPITO_infoCell(PMEP[2],"alap","Építési sor megtelt. " + writeAllBuildTime(allBuildTime));
		szem4_EPITO_addIdo(PMEP[2],firstBuildTime);
		return;
	}
	
	/* Jelenlegi épületszintek kiszámítása építési sorral együtt */
	let currentBuildLvls=EPIT_REF.game_data.village.buildings;
	currentBuildLvls = Object.fromEntries(Object.entries(currentBuildLvls).map(([key, value]) => [key, parseInt(value)]));
	
	for (var i=0;i<buildList.length;i++) {
		currentBuildLvls[buildList[i]]++;
	}

	/* Következő építendő épület meghatározása */
	var nextToBuild = '';
	var buildOrderArr=buildOrder.split(";");
	for (var i=0;i<buildOrderArr.length;i++) {
		const entry = parseBuildEntry(buildOrderArr[i]);
		let candidates = buildCandidates(entry.parts, currentBuildLvls);
		if (candidates.length === 0) continue; // this entry is already met
		/* ANY() takes the first option the village can actually pay for, so an
		   expensive step no longer idles the village while a cheaper one in the
		   same entry was affordable. FASTEST() orders them by build time. */
		/* Innermost modifier first, so ANY(FASTEST(...)) reads as "sort by
		   build time, then take the first one we can actually pay for". */
		for (let m = entry.modifiers.length - 1; m >= 0; m--) {
			candidates = applyBuildModifier(entry.modifiers[m], candidates, EPIT_REF);
		}
		nextToBuild = candidates[0];
		break;
	}

	/* Minden épület kész */
	if (nextToBuild === '') {
		naplo("Építő",'<a href="'+gameUrl({ village: PMEP[0] })+'" target="_BLANK">'+EPIT_REF.game_data.village.name+" ("+EPIT_REF.game_data.village.x+"|"+EPIT_REF.game_data.village.y+")</a> falu teljesen felépült és törlődött a listából");
		setTimeout(() => playSound("falu_kesz"), 1500);
		szem4_EPITO_addIdo(PMEP[2],"del");
		return;
	}

	/* Cél szükségeletének lekérése */
	var nextToBuildRow = EPIT_REF.document.getElementById('main_buildrow_' + nextToBuild);
	if (!nextToBuildRow) {
		szem4_EPITO_infoCell(PMEP[2],firstBuildTime==0?"red":"yellow", nextToBuild+" nem építhető. Előfeltétel szükséges? " + writeAllBuildTime(allBuildTime));
		szem4_EPITO_addIdo(PMEP[2], firstBuildTime>0?firstBuildTime:60);
		return;
	}
	var resNeed = buildingCost(nextToBuildRow);
	if (Math.max(resNeed.wood, resNeed.stone, resNeed.iron) > EPIT_REF.game_data.village.storage_max) nextToBuild = 'storage+';
	if (resNeed.pop > (EPIT_REF.game_data.village.pop_max - EPIT_REF.game_data.village.pop)) nextToBuild = 'farm+';
	if (nextToBuild == 'farm+' && EPIT_REF.game_data.village.buildings.farm == 30) {
		szem4_EPITO_infoCell(PMEP[2],"red","Tanya megtelt, építés nem folytatható. " + writeAllBuildTime(allBuildTime));
		szem4_EPITO_addIdo(PMEP[2], 120);
		return;
	}
	if (nextToBuild == 'farm+' && buildList.includes('farm')) {
		szem4_EPITO_infoCell(PMEP[2],'yellow', 'Tanya megtelt, de már építés alatt... ' + writeAllBuildTime(allBuildTime));
		szem4_EPITO_addIdo(PMEP[2], 120);
		return;
	}
	if (nextToBuild == 'farm+' || nextToBuild == 'storage+') {
		nextToBuild = nextToBuild.slice(0, -1);
		nextToBuildRow = gameEl(EPIT_REF, '#main_buildrow_' + nextToBuild, `epulet sora: ${nextToBuild}`);
		resNeed = buildingCost(nextToBuildRow);
		resNeed.pop = 0; // a farm or warehouse is being inserted precisely to make room
		// Farm kéne, de raktár nincs hozzá ~>
		if (Math.max(resNeed.wood, resNeed.stone, resNeed.iron) > EPIT_REF.game_data.village.storage_max) {
			nextToBuild = 'storage';
			nextToBuildRow = gameEl(EPIT_REF, '#main_buildrow_' + nextToBuild, `epulet sora: ${nextToBuild}`);
			resNeed = buildingCost(nextToBuildRow);
			resNeed.pop = 0; // ditto
		}
	}

	if (EPIT_REF.game_data.village.wood < resNeed.wood || EPIT_REF.game_data.village.stone < resNeed.stone || EPIT_REF.game_data.village.iron < resNeed.iron) {
		szem4_EPITO_infoCell(PMEP[2],"yellow","Nyersanyag hiány lépett fel. " + writeAllBuildTime(allBuildTime));
		szem4_EPITO_addIdo(PMEP[2],firstBuildTime>0?Math.min(firstBuildTime, 60):20);
		return;
	} 

	/* Minden rendben, építhető, klikk */
	szem4_EPITO_infoCell(PMEP[2],"alap","Építés folyamatban.");
	var buildBtn = nextToBuildRow.querySelector('.btn.btn-build');
	if (buildBtn.style.display == 'none') {
		if (buildList.length < 2) {
			szem4_EPITO_infoCell(PMEP[2],"red","Ismeretlen hiba. " + writeAllBuildTime(allBuildTime));
		} else {
			szem4_EPITO_infoCell(PMEP[2],"alap","Építkezési sor megtelt. " + writeAllBuildTime(allBuildTime));
		}
		szem4_EPITO_addIdo(PMEP[2],firstBuildTime>0?firstBuildTime:60);
		return;
	}
	buildBtn.click();
	playSound("epites");
}catch(e){debug("epit_IntelliB",e);}}

function szem4_EPITO_motor(){try{
	var nexttime=750;
	if (BOT||EPIT_PAUSE||USER_ACTIVITY) {nexttime=5000;} else {
	if (EPIT_HIBA>10) {EPIT_HIBA=0; EPIT_GHIBA++; if(EPIT_GHIBA>3) {if (EPIT_GHIBA>5) {naplo("Globál","Nincs internet? Folyamatos hiba az építőnél"); nexttime=60000; playSound("bot2");} EPIT_REF.close();} EPIT_LEPES=0;}
	switch (EPIT_LEPES) {
		case 0: PMEP=szem4_EPITO_Wopen(); /*FaluID;lista;link_a_faluhoz*/
				if (PMEP[0]) {
					EPIT_REF=windowOpener('epit', gameUrl({ village: PMEP[0], screen: 'main', mode: null, group: null, page: null }), AZON+"_SZEM4EPIT");
					EPIT_LEPES=1;
				} else {
					if (document.getElementById("epit_lista").rows.length==1) 
						nexttime=5000;
					else {
						nexttime=60000;
						if (MOBILE_MODE) EPIT_REF.close();
					}
				}
				if (EPIT_REF && EPIT_REF.document) EPIT_REF.document.title = 'szem4/építő';
				break;
		case 1: if (isPageLoaded(EPIT_REF,PMEP[0],"screen=main", ['#buildings'])) {EPIT_HIBA=0; EPIT_GHIBA=0;
					szem4_EPITO_IntettiBuild(PMEP[1]);
				} else {EPIT_HIBA++;}
				EPIT_LEPES=0;
				break;
		default: EPIT_LEPES=0;
	}
	
	/*
	1.) Megnézzük melyik falut kell megnyitni -->főhadi.
	2.) <5 sor? Mit kell venni? Lehetséges e? Ha nem, lehet e valamikor az életbe? (tanya/raktár-vizsgálat)
	3.) Nincs! xD
	*/}
}catch(e){debug("Epito motor",e); EPIT_LEPES=0;}
var inga=100/((Math.random()*40)+80);
nexttime=Math.round(nexttime*inga);
try{
	worker.postMessage({'id': 'epit', 'time': nexttime});
}catch(e){debug('epit', 'Worker engine error: ' + e);setTimeout(function(){szem4_EPITO_motor();}, 3000);}}

ujkieg_hang("Építő","epites;falu_kesz;kritikus_hiba");
ujkieg("epit","Építő",'<tr><td><h2 align="center">Építési listák</h2><table align="center" class="vis" style="border:1px solid black;color: black;"><tr><th onmouseover=\'sugo(this,"Építési lista neve, amire később hivatkozhatunk")\'>Csoport neve</th><th onmouseover=\'sugo(this,"Az építési sorrend megadása. Saját lista esetén ellenőrizzük az OK? linkre kattintva annak helyességét!")\' style="width:800px">Építési lista</th></tr><tr><td>Alapértelmezett</td><td><input type="text" disabled="disabled" value="main 10;storage 10;wall 10;main 15;wall 15;storage 15;farm 10;main 20;wall 20;MINES 10;smith 5;barracks 5;stable 5;storage 20;farm 20;market 10;main 22;smith 12;farm 25;storage 28;farm 26;MINES 24;market 19;barracks 15;stable 10;garage 5;MINES 26;farm 28;storage 30;barracks 20;stable 15;farm 30;barracks 25;stable 20;MINES 30;smith 20;snob 1" size="125"><a onclick="szem4_EPITO_cscheck(this)" style="color:blue; cursor:pointer;"> OK?</a></td></tr></table><p align="center" style="max-width:880px; margin:8px auto 0; font-size:0.95em; line-height:1.5"><b>Kapcsolók.</b> <b>ANY(...)</b>: a felsoroltak közül arra épít, amire éppen van nyersanyagod, így nem áll le egy drága lépésnél. Több cél vesszővel elválasztva: <b>ANY(barracks 5, stable 5)</b> vagy <b>ANY(MINES 25)</b>. &nbsp; <b>FASTEST(...)</b>: a leggyorsabban felépülőt választja. A kettő egymásba ágyazható: <b>ANY(FASTEST(MINES 25))</b> = amire van nyersed, abból a leggyorsabb. Ha egyikre sincs elég nyersanyag, ugyanúgy vár, mint eddig.</p><p align="center">Csoportnév: <input type="text" value="" size="30" id="epit_ujcsopnev" placeholder="Nem tartalmazhat . _ ; karaktereket"> <a href="javascript: szem4_EPITO_ujCsop()" style="color:white;text-decoration:none;"><img src="'+pic("plus.png")+' " height="17px"> Új csoport</a></p></td></tr><tr><td><h2 align="center">Építendő faluk</h2><table align="center" class="vis" style="border:1px solid black;color: black;width:950px" id="epit_lista"><tr><th style="width: 250px;" onclick=\'rendez("szoveg",false,this,"epit_lista",0)\' onmouseover=\'sugo(this,"Rendezhető. Itt építek. Dupla klikk a falura = sor törlése")\'>Falu</th><th onclick=\'rendez("lista",false,this,"epit_lista",1)\' onmouseover=\'sugo(this,"Rendezhető. Felső táblázatban használt lista közül választhatsz egyet, melyet később bármikor megváltoztathatsz.")\' style="width: 135px;">Használt lista</th><th style="width: 130px; cursor: pointer;" onclick=\'rendez("datum",false,this,"epit_lista",2)\' onmouseover=\'sugo(this,"Rendezhető. Ekkor fogom újranézni a falut, hogy lehet e már építeni.<br>Dupla klikk=idő azonnalira állítása.")\'>Return</th><th style="cursor: pointer;" onclick=\'rendez("szoveg",false,this,"epit_lista",3)\' onmouseover=\'sugo(this,"Rendezhető. Szöveges információ a faluban zajló építésről. Sárga hátterű szöveg orvosolható; kék jelentése hogy nem tud haladni; piros pedig kritikus hibát jelöl; a szín nélküli a normális működést jelzi.<br>Dupla klikk=alaphelyzet")\'><u>Infó</u></th></tr></table><p align="center" id="epit_ujfalu_adat">Csoport: <select><option value="Alapértelmezett">Alapértelmezett</option> </select> \Faluk: <input type="text" value="" placeholder="Koordináták: 123|321 123|322 ..." size="50"> \<a href="javascript: szem4_EPITO_ujFalu()" style="color:white;text-decoration:none;"><img src="'+pic("plus.png")+'" height="17px"> Új falu(k)</a></p></td></tr>');

var EPIT_LEPES=0;
var EPIT_REF; var EPIT_HIBA=0; var EPIT_GHIBA=0;
var PMEP; var EPIT_PAUSE=true;
szem4_EPITO_motor();
szem4_EPITO_perccsokkento();

/*-----------------GYŰJTÖGETŐ--------------------*/
/* The gatherer drives InnoGames' own scavenging helper rather than
   reimplementing it. That path is market-specific -- com_DS_HU is the
   Hungarian one -- so playing on another server means changing this line.
   It is stated once and reused by the on-screen instructions further down,
   so what the script loads and what the interface tells you to load cannot
   drift apart. */
const SCAVENGE_SCRIPT_URL = 'https://media.innogames.com/com_DS_HU/scripts/scavenging.js';

/* $.getScript returns a promise whose rejection was never handled. If the
   file moves or the market is wrong, nothing loads, the page never reaches
   the state the next step waits for, and the gatherer counts to thirty
   errors and restarts -- forever, saying only that something is wrong.
   A failure here is now reported with the URL that failed. */
function loadScavengeHelper(reason) {try{
	const pending = GYUJTO_REF.$.getScript(SCAVENGE_SCRIPT_URL);
	if (pending && typeof pending.fail === 'function') {
		pending.fail(function (xhr, status, err) {
			naplo('Gyűjtögető ⚠', `A gyűjtögető segédscriptje nem tölthető be, így nem tud dolgozni. Cím: ${SCAVENGE_SCRIPT_URL}`);
			debug('loadScavengeHelper', `${reason}: ${SCAVENGE_SCRIPT_URL} -> ${status}${err ? ' ' + err : ''}`);
		});
	}
}catch(e){ debug('loadScavengeHelper', e); }}
function gyujto_listAllVillages() {
	let rows = '';
	for (const key in KTID) {
		let faluId = KTID[key];
		rows += `<tr id="gy_${faluId}">
			<td>${ID_TO_INFO[faluId].name} (${key})</td>
			<td>${ID_TO_INFO[faluId].point}</td>
			<td>${ID_TO_INFO[faluId].pop}</td>
			<td onclick="gyujto_setVill(${faluId}, this)"><input name="f${faluId}" type="checkbox"></td>
			<td>---</td>
		</tr>`;
	}
	return rows;
}
function gyujto_setVill(villId, el, isForcedSingle=false, forcedValue) {
	const isMulti = document.querySelector('#gyujto_ismass').checked;
	if (!isForcedSingle && isMulti) {
		const multiOperationVal = !SZEM4_GYUJTO[villId];
		document.querySelectorAll(`#gyujto_form_table tr:not([style*="display: none"]) td input[type="checkbox"]`).forEach(el => {
			gyujto_setVill(el.getAttribute('name').replace('f', ''), el.parentElement, true, multiOperationVal);
		});
	} else {
		let newVal = true;
		if (forcedValue !== undefined) {
			newVal = forcedValue;
		} else {
			if (SZEM4_GYUJTO[villId] == undefined)
				newVal = true;
			else
				newVal= !SZEM4_GYUJTO[villId];
		}
		SZEM4_GYUJTO[villId] = newVal;
		el.querySelector('input').checked = SZEM4_GYUJTO[villId];
	}
}
function rebuildDOM_gyujto() {
	const f = document.querySelector('#gyujto_form');
	for (let villId in SZEM4_GYUJTO) {
		if (SZEM4_GYUJTO[villId] === true) f['f' + villId].checked = true;
	}
	f.strategy.value = SZEM4_GYUJTO.settings.strategy;
}
function szem4_GYUJTO_search(ev) {
	ev.stopImmediatePropagation();
	let vills = prompt('Szűrés ezen falukra:\nÜres=minden');
	const gyujtoTable = document.querySelector('#gyujto_form_table').rows;

	if (vills == '') {
		for (let i=1;i<gyujtoTable.length;i++) {
			gyujtoTable[i].style.display = 'table-row';
		}
	}
	if (!vills) return;
	vills = vills.match(/[0-9]{1,3}\|[0-9]{1,3}/g);
	if (!vills || vills.length < 1) return;

	
	for (let i=1;i<gyujtoTable.length;i++) {
		const tc = gyujtoTable[i].cells[0].textContent;
		if (vills.some(el => tc.includes(`(${el})`))) {
			gyujtoTable[i].style.display = 'table-row';
		} else {
			gyujtoTable[i].style.display = 'none';
		}
	}
}
function szem4_GYUJTO_1keres() {try{
	let d = getServerTime();
	for (const coord in KTID) {
		const villId = KTID[coord];
		if (!GYUJTO_VILLINFO[villId]) GYUJTO_VILLINFO[villId] = { retry: false };
		if (SZEM4_GYUJTO[villId] === true && (!GYUJTO_VILLINFO[villId].returned || GYUJTO_VILLINFO[villId].returned < d)) {
			GYUJTO_REF = windowOpener('gyujto', gameUrl({ village: villId, screen: 'place', mode: 'scavenge', group: null, page: null }), AZON + '_gyujto');
			GYUJTO_STATE = 1;
			GYUJTO_DATA = villId;
			return false;
		}
	}
	return true;
} catch(e) { GYUJTO_HIBA++; console.error(e); debug('szem4_GYUJTO_1keres', e); }}
function szem4_GYUJTO_3elindit() { try{
	const buttons = GYUJTO_REF.document.querySelectorAll('#scavenge_screen .free_send_button');
	/* Options are listed worst to best, so the last is the most valuable and
	   remains the preference. But only ever testing the last one meant a single
	   unavailable option -- not yet unlocked, or too few troops left for its
	   share -- was read as "nothing left to send", and the remaining options sat
	   idle. Walk back to the best option that can actually be sent. */
	let startButton = null, scavTime = null;
	for (let i = buttons.length - 1; i >= 0; i--) {
		const option = buttons[i].closest('.scavenge-option');
		const duration = option && option.querySelector('.duration-section');
		if (duration && duration.style.display !== 'none') {
			startButton = buttons[i];
			scavTime = duration;
			break;
		}
	}
	if (!startButton) {
		if (buttons.length > 0 && GYUJTO_VILLINFO[GYUJTO_DATA].retry !== true) {
			GYUJTO_VILLINFO[GYUJTO_DATA].retry = true;
			GYUJTO_STATE = 0;
			return;
		}
		if (buttons.length > 0) {
			console.info(new Date().toLocaleString(), `faluId: ${GYUJTO_DATA} STILL VÉGE`, buttons.length, buttons);
			debug('szem4_GYUJTO_3elindit', `Gyűjtögető: ${buttons.length} lehetőség közül egyik sem indítható (kétszer is ellenőrizve), pedig nem minden slot foglalt.`);
			playSound('naplobejegyzes');
		}
		GYUJTO_VILLINFO[GYUJTO_DATA].retry = false;
		GYUJTO_STATE = 0;
		const allReturnTimer = GYUJTO_REF.document.querySelectorAll('.return-countdown');
		let d = getServerTime(GYUJTO_REF);
		if (allReturnTimer.length == 0) {
			// Nem lehet gyűjtögetni itt. 20p múlva újra nézi
			GYUJTO_VILLINFO[GYUJTO_DATA].returned = d.setSeconds(d.getSeconds() + 1200);
		} else {
			const timesInSec = [];
			allReturnTimer.forEach(el => {
				let [hours, minutes, seconds] = el.textContent.split(":").map(Number);
				timesInSec.push(hours * 3600 + minutes * 60 + seconds);
			});
	
			const nextTime = SZEM4_GYUJTO.settings.strategy === 'max' ? Math.max(...timesInSec) : Math.min(...timesInSec);
			GYUJTO_VILLINFO[GYUJTO_DATA].returned = d.setSeconds(d.getSeconds() + nextTime + 60);
		}

		document.querySelector(`#gy_${GYUJTO_DATA}`).cells[4].innerHTML = new Date(GYUJTO_VILLINFO[GYUJTO_DATA].returned).toLocaleString();
		GYUJTO_HIBA = 0;
		return;
	}
	GYUJTO_VILLINFO[GYUJTO_DATA].retry = false;
	GYUJTO_HIBA++;
	startButton.click();
} catch(e) { GYUJTO_HIBA++; console.error(e); debug('szem4_GYUJTO_3elindit', e); }}
function szem4_GYUJTO_motor() {
	let nexttime = 500;
	try {
		if (BOT||GYUJTO_PAUSE||USER_ACTIVITY) {
			nexttime=5000;
		} else {
			if (GYUJTO_HIBA > 30) {
				naplo('szem4_GYUJTO_motor', `Valami baj van a gyűjtögetőnél (${GYUJTO_STATE}. lépésben elakadt) - újraindítom... Oldal: ${pageUrl(GYUJTO_REF)}`);
				GYUJTO_REF.close();
				GYUJTO_STATE = 0;
				GYUJTO_HIBA = 0;
			}
			switch (GYUJTO_STATE) {
				case 0:
					// Search & OpenVill
					if (szem4_GYUJTO_1keres()) {
						nexttime = 60000;
						if (MOBILE_MODE) GYUJTO_REF.close()
					}
					if (GYUJTO_REF && GYUJTO_REF.document) GYUJTO_REF.document.title = 'szem4/gyűjtögető';
					break;
				case 1:
					// run 3rdparty script
					if (isPageLoaded(GYUJTO_REF, GYUJTO_DATA, 'screen=place&mode=scavenge', ['#scavenge_screen .scavenge-option'])) {
						loadScavengeHelper('első betöltés');
						GYUJTO_STATE = 2;
					} else GYUJTO_HIBA++;
					break;
				case 2:
					// Check, click, store
					if (isPageLoaded(GYUJTO_REF, GYUJTO_DATA, 'screen=place&mode=scavenge', ['#twcheese-sidebar', '#content_value > h3 > a'])) {
						szem4_GYUJTO_3elindit();
					} else {
						GYUJTO_HIBA++;
						if (GYUJTO_HIBA == 15) loadScavengeHelper('újrapróbálkozás 15 sikertelen ellenőrzés után');
					}
					break;
			}
		}
	} catch(e) {
		console.error(e);
		debug('gyujto_motor', e);
	}
	try{
		worker.postMessage({'id': 'gyujto', 'time': nexttime});
	}catch(e){debug('gyujto_motor', 'Worker engine error: ' + e);setTimeout(function(){szem4_GYUJTO_motor();}, 1000);}
}
var SZEM4_GYUJTO = defaultGyujtoState(), //VillId: isEnabled
GYUJTO_VILLINFO = {}, // villId: {returned: xxxDatexxx, retry: bool}
GYUJTO_STATE = 0,
GYUJTO_REF,
GYUJTO_DATA,
GYUJTO_HIBA = 0,
GYUJTO_PAUSE = true;
ujkieg('gyujto','Gyűjtő',`<tr><td>
	<h2 align="center">3rdparty gyűjtögető</h2>
	<h4 align="center">Powered by TwCheese</h4>
	<br><br>
	Ez a script külön beállítást igényel. Ehhez az alábbi, legálisan is futtható scriptet kell futtatnod a gyülekezőhelyeden, a gyűjtögetésnél:<br>
	<pre>$.getScript('${SCAVENGE_SCRIPT_URL}');</pre><br>
	SZEM ezt a scriptet fogja automata módban futtatni az alább bejelöld faluidban, az ott beállított módon.<br>
	<form id="gyujto_form">
		<table class="vis gyujto_table" id="gyujto_form_table">
			<thead><tr>
				<th onclick="rendez('szoveg', false, this, 'gyujto_form_table', 0)">Falu
					<img src="${pic("search.png")}" alt="Szűrő" title="Szűrés falukra..." onclick="szem4_GYUJTO_search(event)">
					<input type="checkbox" onclick="stopEvent(event)" id="gyujto_ismass" onmouseover="sugo(this,'Tömeges kezelés: minden látott falura érvényes lesz a további művelet')" title="Tömeges kezelés"></th>
				<th onclick="rendez('szam', false, this, 'gyujto_form_table', 1)">Pont</th>
				<th onclick="rendez('tanya', false, this, 'gyujto_form_table', 2)">Tanya</th>
				<th onclick="rendez('checkbox', false, this, 'gyujto_form_table', 3)">Gyűjtögetés?</th>
				<th onclick="rendez('datum', false, this, 'gyujto_form_table', 4)">Gyűjtés eddig</th>
			</tr></thead>
			<tbody>${gyujto_listAllVillages()}</tbody>
		</table>
		<br><br>
		Stratégia:
		<select name="strategy">
			<option value="min">Amint kész egy gyűjtés, küldje a következőt</option>
			<option value="max">Várja meg amíg minden opció kész, és utána küldje újra</option>
		</select>
	</form>
</td></tr>`);
szem4_GYUJTO_motor();

/*-----------------Adatmentő kezelő--------------------*/
/* Refuses to replace substantial saved data with something drastically
   smaller. The autosave writes whatever is in memory every 60 seconds, so a
   failed load silently becomes permanent data loss one minute later. A save
   that collapses to under a quarter of what is stored is far more likely to
   be a failed load than a real edit, so it is skipped and reported loudly.

   Deleting farms deliberately still works: removals are gradual, and the
   Adatmento delete button bypasses this entirely. */
function storeGuarded(key, value, label) {
	var prev = localStorage.getItem(key);
	if (prev && prev.length > 200 && value.length < prev.length / 4) {
		naplo('Adatmentő ⚠', `${label}: mentés kihagyva. A mentendő adat (${value.length} karakter) sokkal kisebb a már tároltnál (${prev.length}), ami általában sikertelen betöltést jelent. A régi adat érintetlen maradt.`);
		return false;
	}
	localStorage.setItem(key, value);
	return true;
}

function szem4_ADAT_saveNow(tipus) {
	let dateEl = document.querySelector(`#adat_opts input[name=${tipus}]`);
	if (dateEl) dateEl = dateEl.closest('tr').cells[2];
	switch (tipus) {
		case "farm":   storeGuarded(AZON+"_farm", JSON.stringify(SZEM4_FARM), 'Farmoló'); break;
		case "epit":   szem4_ADAT_epito_save(); break;
		case "vije":   storeGuarded(AZON+"_vije", JSON.stringify(SZEM4_VIJE), 'Jelentés Elemző'); break;
		case "sys":    storeGuarded(AZON+"_sys", JSON.stringify(SZEM4_SETTINGS), 'Beállítások'); break;
		case "gyujto": storeGuarded(AZON + '_gyujto', JSON.stringify(SZEM4_GYUJTO), 'Gyűjtögető'); break;
		case 'cloud':  saveLocalDataToCloud(false, false);
	}
	if (dateEl) dateEl.innerHTML = new Date().toLocaleString();
	return;
}
function szem4_ADAT_loadNow(tipus) {try{
	let dataObj = localStorage.getItem(`${AZON}_${tipus}`);
	if (!dataObj) return; else if (tipus != 'epit') dataObj = JSON.parse(dataObj);
	switch (tipus) {
		case "farm":
			SZEM4_FARM = Object.assign({}, SZEM4_FARM, dataObj);
			debug('szem4_ADAT_loadNow', 'Loading debug: FROM = ' + JSON.stringify(SZEM4_FARM.DOMINFO_FROM));
			debug('szem4_ADAT_loadNow', 'Loading debug: FROM original = ' + JSON.stringify(dataObj));
			if (Object.keys(SZEM4_FARM.DOMINFO_FROM) == 0) {
				naplo('Farm', 'Nem található a model-ben farmoló falu. Hiba? Lehet újra hozzá kell adnod.')
			}
			rebuildDOM_farm();
			break;
		case "epit": szem4_ADAT_epito_load(); break; // FIXME! MVC Hiányzik!!
		case "vije":
			SZEM4_VIJE = Object.assign({}, SZEM4_VIJE, dataObj);
			rebuildDOM_VIJE();
			break;
		case "sys":
			SZEM4_SETTINGS = Object.assign({}, SZEM4_SETTINGS, dataObj);
			const stilusFrissitve = upgradeStyleDefaults(SZEM4_SETTINGS);
			if (stilusFrissitve) naplo('Be\u00e1ll\u00edt\u00e1s', 'A r\u00e9gi alap\u00e9rtelmezett sz\u00ednek lecser\u00e9lve az \u00faj s\u00f6t\u00e9t t\u00e9m\u00e1ra. A H\u00e1tt\u00e9r- \u00e9s st\u00edlus be\u00e1ll\u00edt\u00e1sn\u00e1l b\u00e1rmelyik \u00e1t\u00edrhat\u00f3.');
			loadSettings();
			break;
		case "gyujto":
			SZEM4_GYUJTO = Object.assign({}, SZEM4_GYUJTO, dataObj);
			rebuildDOM_gyujto();
			break;
		default: debug('szem4_ADAT_loadNow', `Nincs ilyen típus: ${tipus}`);
	}
}catch(e) {debug('szem4_ADAT_loadNow', `Hiba ${tipus} adatbetöltésénél: ${e}`);}}

/* The delete button only removes the stored copy. Whatever is in memory
   survives it, and the autosave writes it straight back within the minute,
   so on a running instance deleting alone achieves nothing. Reset clears
   both, which is what makes it stick.

   Some of the interface is rebuilt in place; the rest is only fully clean
   after reloading SZEM, which the confirmation says. */
function szem4_ADAT_restart(tipus) {try{
	const labels = {
		farm: 'Farmol\u00f3', vije: 'Jelent\u00e9s Elemz\u0151', epit: '\u00c9p\u00edt\u0151',
		gyujto: 'Gy\u0171jt\u00f6get\u0151', sys: 'Hangok \u00e9s t\u00e9m\u00e1k'
	};
	const label = labels[tipus];
	if (!label) { alert2(`Nincs ilyen t\u00edpus: ${tipus}`); return; }

	if (!confirm(`Biztosan alaphelyzetbe \u00e1ll\u00edtod ezt: ${label}?\n\n`
		+ `T\u00f6rl\u0151dik a mem\u00f3ri\u00e1ban l\u00e9v\u0151 \u00e9s a lementett adat is. Ez nem vonhat\u00f3 vissza.\n\n`
		+ `Ha el\u0151bb biztons\u00e1gi m\u00e1solatot szeretn\u00e9l, haszn\u00e1ld az Export gombot.\n\n`
		+ `A teljesen tiszta felülethez ut\u00e1na t\u00f6ltsd \u00fajra a SZEM-et.`)) return;

	switch (tipus) {
		case 'farm':
			SZEM4_FARM = defaultFarmState();
			rebuildDOM_farm();
			break;
		case 'vije':
			SZEM4_VIJE = defaultVijeState();
			readUpVijeOpts(); // put the form's own defaults back into i18ns
			break;
		case 'gyujto':
			SZEM4_GYUJTO = defaultGyujtoState();
			// rebuildDOM_gyujto only ever ticks boxes, so clear them first
			document.querySelectorAll('#gyujto_form_table input[type="checkbox"]').forEach(el => { el.checked = false; });
			rebuildDOM_gyujto();
			break;
		case 'sys':
			SZEM4_SETTINGS = defaultSettingsState();
			selectTheme(1);
			break;
		case 'epit':
			// the builder keeps its state in the table rather than an object
			$('#epit_lista tr:gt(0)').remove();
			break;
	}
	localStorage.removeItem(`${AZON}_${tipus}`);
	naplo('Adatment\u0151', `${label}: alaphelyzetbe \u00e1ll\u00edtva, a mentett adat t\u00f6r\u00f6lve.`);
	alert2(`${label}: alaphelyzetbe \u00e1ll\u00edtva.`);
}catch(e){ debug('szem4_ADAT_restart', e); alert2('Hiba alaphelyzetbe \u00e1ll\u00edt\u00e1skor:\n' + e); }}

/**
 * By default, all save is enabled. This function sets all to disabled
 */
function szem4_ADAT_StopAll(){
	document.querySelectorAll('#adat_opts input[type="checkbox"]').forEach(chk => {
		chk.checked = false;
	});
	return;
}

function szem4_ADAT_LoadAll(){
	ALL_EXTENSION.forEach(id => {
		try{szem4_ADAT_loadNow(id);}catch(e){console.error(e); debug('szem4_ADAT_LoadAll', 'Error ID: ' + id + ' -- ' + e)}
	});
	szem4_ADAT_loadNow('sys');
}

/* The builder's saved state used to be one string: groups and villages joined
   by "_", entries by ".", and a group's name separated from its build list by
   "-". Group names may contain "-" (ujCsop only strips ";", "." and "_"), so
   naming a group "Gyors-epites" silently truncated its build list on reload.

   Loading was positional too: it recreated each group, then wrote the build
   list into row i+2 by index. Any group that failed to appear -- a duplicate
   name, say -- shifted every later row, which is the "rows[(i+2)] is
   undefined" failure this has thrown before.

   It is JSON now, like every other module. Villages are stored by coordinate
   rather than by display label, since the label embeds a village name that
   the game may change. */

function szem4_EPITO_parseLegacy(text) {
	const [groupPart = '', villagePart = '', assignPart = ''] = text.split('_');
	const groups = groupPart.split('.').filter(Boolean).map(entry => {
		const cut = entry.indexOf('-');
		return cut === -1
			? { name: entry, list: '' }
			: { name: entry.slice(0, cut), list: entry.slice(cut + 1) };
	});
	const labels = villagePart ? villagePart.split('.') : [];
	const assigned = assignPart ? assignPart.split('.') : [];
	const villages = [];
	labels.forEach((label, i) => {
		const found = label.match(/[0-9]{1,3}\|[0-9]{1,3}/);
		if (found) villages.push({ coord: found[0], group: assigned[i] || 'Alap\u00e9rtelmezett' });
	});
	return { v: 2, groups, villages };
}

function szem4_EPITO_applyState(state) {
	const groupTable = document.getElementById("epit").getElementsByTagName("table")[0];
	const villageTable = document.getElementById("epit_lista");
	const groupPicker = document.getElementById("epit_ujfalu_adat").getElementsByTagName("select")[0];

	/* row 1 of the group table is the built-in default, which stays */
	for (let i = groupTable.rows.length - 1; i > 1; i--) groupTable.deleteRow(i);
	for (let i = villageTable.rows.length - 1; i > 0; i--) villageTable.deleteRow(i);
	while (groupPicker.length > 1) groupPicker.remove(1);

	/* Created through the existing button so every select stays wired up, then
	   located by name -- a group that fails to appear no longer shifts the ones
	   after it into the wrong rows. */
	(state.groups || []).forEach(group => {
		document.getElementById("epit_ujcsopnev").value = group.name;
		szem4_EPITO_ujCsop();
		const row = [...groupTable.rows].find(r => r.cells[0] && r.cells[0].textContent === group.name);
		if (!row) {
			debug('szem4_EPITO_applyState', `A(z) "${group.name}" csoport nem j\u00f6tt l\u00e9tre, kihagyva.`);
			return;
		}
		row.cells[1].getElementsByTagName("input")[0].value = group.list;
	});

	const coords = (state.villages || []).map(v => v.coord).filter(Boolean);
	if (coords.length) {
		document.getElementById("epit_ujfalu_adat").getElementsByTagName("input")[0].value = coords.join(' ');
		szem4_EPITO_ujFalu();
	}

	/* Assignments matched by coordinate, not by row order: a village that was
	   skipped (sold, or no longer yours) must not shift everyone else's group. */
	const wanted = {};
	(state.villages || []).forEach(v => { wanted[v.coord] = v.group; });
	for (let i = 1; i < villageTable.rows.length; i++) {
		const found = villageTable.rows[i].cells[0].textContent.match(/[0-9]{1,3}\|[0-9]{1,3}/);
		if (!found) continue;
		const group = wanted[found[0]];
		const select = villageTable.rows[i].cells[1].getElementsByTagName("select")[0];
		if (group && [...select.options].some(o => o.text === group)) select.value = group;
	}
}

function szem4_ADAT_epito_save(){try{
	const groupTable = document.getElementById("epit").getElementsByTagName("table")[0];
	const groups = [];
	for (let i = 2; i < groupTable.rows.length; i++) {
		groups.push({
			name: groupTable.rows[i].cells[0].textContent,
			list: groupTable.rows[i].cells[1].getElementsByTagName("input")[0].value
		});
	}

	const villageTable = document.getElementById("epit_lista");
	const villages = [];
	for (let i = 1; i < villageTable.rows.length; i++) {
		const found = villageTable.rows[i].cells[0].textContent.match(/[0-9]{1,3}\|[0-9]{1,3}/);
		if (!found) continue;
		villages.push({
			coord: found[0],
			group: villageTable.rows[i].cells[1].getElementsByTagName("select")[0].value
		});
	}

	/* the save date is stamped by szem4_ADAT_saveNow, which calls this */
	storeGuarded(AZON+"_epit", JSON.stringify({ v: 2, groups, villages }), '\u00c9p\u00edt\u0151');
}catch(e){debug("ADAT_epito_save",e);}}

function szem4_ADAT_epito_load(){try{
	const raw = localStorage.getItem(AZON+"_epit");
	if (!raw) return;

	let state = null;
	try { state = JSON.parse(raw); } catch (e) { state = null; }

	if (!state || !Array.isArray(state.groups)) {
		state = szem4_EPITO_parseLegacy(raw);
		/* Keep the original untouched: this is the one format change that cannot
		   be undone by checking out an older version of the script. */
		if (!localStorage.getItem(AZON+"_epit_legacy")) localStorage.setItem(AZON+"_epit_legacy", raw);
		naplo('\u00c9p\u00edt\u0151', `A r\u00e9gi form\u00e1tum\u00fa \u00e9p\u00edt\u00e9si adat \u00e1talak\u00edtva (${state.groups.length} csoport, ${state.villages.length} falu). Az eredeti megmaradt a(z) ${AZON}_epit_legacy kulcson.`);
	}

	szem4_EPITO_applyState(state);
	/* Every other data type loads without a word. This one opened a modal on
	   every single start, which has to be dismissed before SZEM can be used --
	   to report that nothing went wrong. It belongs in the log with the rest. */
	naplo('\u00c9p\u00edt\u0151', `\u00c9p\u00edt\u00e9si adatok bet\u00f6ltve: ${state.groups.length} csoport, ${state.villages.length} falu.`);
}catch(e){debug("ADAT_epito_load",e);}}

function szem4_ADAT_del(tipus){try{
	if (!confirm("Biztos törli a(z) "+tipus+" összes adatát?")) return;
	if (localStorage.getItem(AZON+"_"+tipus)) {
		localStorage.removeItem(AZON+"_"+tipus);
		alert2(tipus+": Törlés sikeres");
	} else alert2(tipus+": Nincs lementett adat");
	return;
}catch(e){alert2("ADAT_epito_load HIBA\n",e);}}

function szem4_ADAT_kiir(tipus){try{
	if (localStorage.getItem(AZON+"_"+tipus)) {
		alert2("<textarea onmouseover='this.select()' onclick='this.select()' cols='38' rows='30'>"+localStorage.getItem(AZON+"_"+tipus)+"</textarea>");
	} else alert2("Nincs lementett adat");
	return;
}catch(e){debug("szem4_ADAT_kiir",e);}}

function szem4_ADAT_betolt(tipus){try{
	var beadat=prompt("Adja meg a korábban SZEM4 ÁLTAL KIÍRT ADATOT, melyet be kíván tölteni.\n\n Ne próbálj kézileg beírni ide bármit is. Helytelen adat megadását SZEM4 nem tudja kezelni, az ebből adódó működési rendellenesség csak RESET-eléssel állítható helyre.");
	if (beadat==null || beadat=="") return;
	localStorage.setItem(AZON+"_"+tipus, beadat);
	szem4_ADAT_loadNow(tipus);
	alert2("Az adatok sikeresen betöltődtek.");
}catch(e){alert2("szem4_ADAT_betolt hiba:\n" + e);}}

// Adat_FELHŐ
function loadCloudSync() {
	if (CLOUD_AUTHS) {
		try {
			CLOUD_AUTHS = JSON.parse(CLOUD_AUTHS);
			if (!CLOUD_AUTHS.authDomain || !CLOUD_AUTHS.projectId || !CLOUD_AUTHS.storageBucket || !CLOUD_AUTHS.messagingSenderId || !CLOUD_AUTHS.appId || !CLOUD_AUTHS.email || !CLOUD_AUTHS.password || !CLOUD_AUTHS.collection || !CLOUD_AUTHS.myDocument)
				throw 'Must consist these fields: authDomain projectId storageBucket messagingSenderId appId email password';
		} catch(e) { naplo('☁️ Sync', 'Invalid Auth data ' + e); }
	} else {
		return;
	}
	/* This file is IIFE-scoped, but the Firebase module injected below reads
	   CLOUD_AUTHS as a BARE global, and the value was reassigned by the JSON.parse
	   above. Publish the parsed object or the module receives the raw string. */
	window.CLOUD_AUTHS = CLOUD_AUTHS;

	const script = document.createElement("script");
	script.type = "module";
	script.innerHTML = `
		import { initializeApp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-app.js";
		import { getFirestore, collection, updateDoc, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-firestore.js";
		import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-auth.js"

		const app = initializeApp(CLOUD_AUTHS);
		const db = getFirestore(app);
		const auth = getAuth();

		signInWithEmailAndPassword(auth, CLOUD_AUTHS.email, CLOUD_AUTHS.password)
		.then(async (userCredential) => {
			const user = userCredential.user;

			window.readUpData = async () => {
				const myDoc = await getDoc(doc(db, CLOUD_AUTHS.collection, CLOUD_AUTHS.myDocument));
				return myDoc.data();
			}
			window.updateData = async (newData) => {
				try {
					const myDoc = await getDoc(doc(db, CLOUD_AUTHS.collection, CLOUD_AUTHS.myDocument));
					await updateDoc(myDoc.ref, newData);
					return 'OK';
				} catch(e) {
					return 'Error: '+e;
				}
			}
			window.naplo('☁️ Sync', 'Firebase felhő kapcsolat létrejött');
			if (confirm("Firebase adatok importálása helyi adatokra?")) {
				window.loadCloudDataIntoLocal();
				window.document.querySelector('#adat_opts input[name="cloud"]').checked = true;
			} else {
				window.szem4_ADAT_LoadAll();
			}
		})
		.catch((error) => {
			const errorCode = error.code;
			const errorMessage = error.message;
		});`;
	document.head.appendChild(script);
}
function loadCloudDataIntoLocal() {
	if (!CLOUD_AUTHS) {
		alert2("Nincs aktív felhő szinkronizáció");
		return;
	}
	readUpData().then((cloudData) => {
		localStorage.setItem(AZON+"_farm",   cloudData.farm);
		localStorage.setItem(AZON+"_vije",   cloudData.vije);
		localStorage.setItem(AZON+"_epit",   cloudData.epit);
		localStorage.setItem(AZON+"_sys",    cloudData.sys);
		localStorage.setItem(AZON+"_gyujto", cloudData.gyujto);
		szem4_ADAT_LoadAll();
	});
}
function saveLocalDataToCloud(isAll, isByHand=false) {
	if (!CLOUD_AUTHS) {
		if (isByHand) alert2("Nincs aktív felhő szinkronizáció");
		return;
	}
	if (isAll) {
		ALL_EXTENSION.forEach(id => {
			if (id !== '')
			szem4_ADAT_saveNow(id);
		});
		szem4_ADAT_saveNow('sys');
	}
	var jsonToSave = {
		farm:  localStorage.getItem(AZON+"_farm"),
		epit:  localStorage.getItem(AZON+"_epit"),
		vije:  localStorage.getItem(AZON+"_vije"),
		sys:   localStorage.getItem(AZON+"_sys"),
		gyujto:localStorage.getItem(AZON+"_gyujto"),
	};
	updateData(jsonToSave).then(() => {
		var d=new Date();
		document.querySelector('#adat_opts input[name="cloud"]').closest('tr').cells[2].textContent = d.toLocaleString();
	});
}

// Adat_MOTOR
function szem4_ADAT_motor() {
	try {
		if (!ADAT_PAUSE) {
			if (ADAT_FIRST) {
				ADAT_FIRST = false;
			} else {
				document.querySelectorAll('#adat_opts input:checked').forEach((el) => {
					szem4_ADAT_saveNow(el.name);
				});
				
			}
		}
 	} catch(e) { debug('ADAT_motor', e)}
	worker.postMessage({'id': 'adatok', 'time': 60000});
}

function szem4_ADAT_AddImageRow(tipus){
	return '\
	<img title="Jelenlegi adat betöltése" alt="Betölt" onclick="szem4_ADAT_loadNow(\''+tipus+'\')" width="17px" src="'+pic("load.png")+'"> \
	<img title="Törlés" alt="Töröl" onclick="szem4_ADAT_del(\''+tipus+'\')" src="'+pic("del.png")+'" width="17px""> \
	<img title="Jelenlegi adat kiiratása" alt="Export" onclick="szem4_ADAT_kiir(\''+tipus+'\')" width="17px" src="'+pic("Export.png")+'"> \
	<img title="Saját adat betöltése" alt="Import" onclick="szem4_ADAT_betolt(\''+tipus+'\')" width="17px" src="'+pic("Import.png")+'"> \
	<img title="Mentés MOST" alt="Save" onclick="szem4_ADAT_saveNow(\''+tipus+'\')" width="17px" src="'+pic("saveNow.png")+'">\
	<img title="Reset: Helyreállítás" alt="Reset" onclick="szem4_ADAT_restart(\''+tipus+'\')" width="17px" src="'+pic("reset.png")+'">';
}

ujkieg("adatok","Adatmentő",'<tr><td>\
<p align="center"><b>Figyelem!</b> Az adatmentő legelső elindításakor betölti a lementett adatokat (ha van), nem törődve azzal, hogy jelenleg mi a munkafolyamat.<br>Új adatok használatához az adatmentő indítása előtt használd a törlést a lenti táblázatból.</p>\
<form id="adatmento-form"><table class="vis" id="adat_opts" style="margin-bottom: 50px;"><tr><th>Engedélyezés</th><th style="padding-right: 20px">Kiegészítő neve</th><th style="min-width:125px; padding-right: 20px;">Utolsó mentés ideje</th><th style="width:150px">Adat kezelése</th></tr>\
<tr><td><input type="checkbox" name="farm" checked></td><td>Farmoló</td><td></td><td>'+szem4_ADAT_AddImageRow("farm")+'</td></tr>\
<tr><td><input type="checkbox" name="epit" checked></td><td>Építő</td><td></td><td>'+szem4_ADAT_AddImageRow("epit")+'</td></tr>\
<tr><td><input type="checkbox" name="vije" checked></td><td>Jelentés elemző</td><td></td><td>'+szem4_ADAT_AddImageRow("vije")+'</td></tr>\
<tr><td><input type="checkbox" name="sys" checked></td><td>Hangok, témák</td><td></td><td>'+szem4_ADAT_AddImageRow("sys")+'</td></tr>\
<tr><td><input type="checkbox" name="gyujto" checked></td><td>Gyűjtögető</td><td></td><td>'+szem4_ADAT_AddImageRow("gyujto")+'</td></tr>\
<tr><td><input type="checkbox" name="cloud" unchecked></td><td><img height="17px" src="'+pic('cloud.png')+'"> Cloud sync</td><td></td><td>\
			<img title="Cloud adat betöltése a jelenlegi rendszerbe" alt="Import" onclick="loadCloudDataIntoLocal()" width="17px" src="'+pic("Import.png")+'"> \
			<img title="Local adat lementése a Cloud rendszerbe" alt="Save" onclick="saveLocalDataToCloud(true, true)" width="17px" src="'+pic("saveNow.png")+'">\
</td></tr>\
</table></form><p align="center"></p></td></tr>');
var ADAT_PAUSE=false, ADAT_FIRST = true;
szem4_ADAT_motor();
var FARM_TESZTER_TIMEOUT;

/* The export block lists what the interface reaches through window, worked
   out by scanning the source. This confirms it against the markup that was
   actually built: anything a handler calls but window does not have would
   otherwise fail silently, on click, long after the mistake. */
/* Note for anyone writing interface text: example syntax such as ANY(...)
   must not go inside an on* attribute. The scan below cannot tell a call from
   a string that merely looks like one, so documentation living in a tooltip
   gets reported as a missing function. Put such text in the panel itself. */
function verifyInlineHandlers() {try{
	const wanted = new Set();
	const html = document.body.innerHTML;
	const handler = /\bon[a-z]+\s*=\s*["']([^"']*)["']|javascript:\s*([^"'`]*)/g;
	let found;
	while ((found = handler.exec(html)) !== null) {
		const body = found[1] || found[2] || '';
		// identifiers that are called, ignoring method calls like this.select()
		const call = /(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
		let c;
		while ((c = call.exec(body)) !== null) wanted.add(c[2]);
	}
	const missing = [...wanted].filter(name => typeof window[name] !== 'function');
	if (missing.length) {
		debug('verifyInlineHandlers', `A fel\u00fcleten olyan vez\u00e9rl\u0151k vannak, amik nem l\u00e9tez\u0151 f\u00fcggv\u00e9nyt h\u00edvnak: ${missing.join(', ')}`);
		naplo('SZEM 4 \u26a0', `${missing.length} vez\u00e9rl\u0151 nem m\u0171k\u00f6dik (r\u00e9szletek a Debug f\u00fcl\u00f6n).`);
	}
}catch(e){ debug('verifyInlineHandlers', e); }}

$(document).ready(function(){
	nyit("naplo");
	naplo('Globál','Verzió ['+VERZIO+'] legfrissebb állapotban, GIT-ről szedve.');
	naplo("Indulás","SZEM 4.7 elindult.");
	naplo("Indulás","Kiegészítők szünetelő módban.");
	botvedelemFigyeloIndit();
	if (TIME_ZONE != 0) naplo('🕐 Időzóna', `Időeltolódás frissítve: eltolódás ${TIME_ZONE} perccel.`);
	soundVolume(0.0);
	playSound("bot2"); /* Ha elmegy a net, tudjon csipogni */
	if (confirm("Engedélyezed az adatok mentését?\nKésőbb is elindíthatja, ha visszapipálja a mentés engedélyezését - ekkor szükséges kézi adatbetöltés is előtte.")) {
		if (CLOUD_AUTHS) {
			naplo("☁️ Sync","Connecting to Firebase Cloud System...");
			loadCloudSync();
		} else {
			naplo("☁️ Sync","Firebase Cloud System is not setup. Create 'szem_firebase' localStorage item with credentials");
			naplo("Adat","Adatbetöltés helyi adatokból...");
			szem4_ADAT_LoadAll();
		}
	} else {
		szem4_ADAT_StopAll();
		onWallpChange();
	}
	setTimeout(function(){soundVolume(1.0);},2000);
	
	$(function() {
		$("#alert2").draggable({handle: $('#alert2head')});
		$('#sugo').mouseover(function() {sugo(this,"Ez itt a súgó");});
		$('#fejresz').mouseover(function() {sugo(this,"");});
	});
	$("#farm_opts").on('change', 'input', function() {
		if (FARM_TESZTER_TIMEOUT) clearTimeout(FARM_TESZTER_TIMEOUT);
		FARM_TESZTER_TIMEOUT = setTimeout(() => shorttest(), 1000);
	});
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Escape') {
			alert2('close');
		}
	});
	document.addEventListener('click', addFreezeNotification);
	document.addEventListener('keypress', addFreezeNotification);
	addFreezeNotification();
	verifyInlineHandlers();
	window.onbeforeunload = function() {return true;}

	// FARMOLÓ
	$('#farm_honnan').on('change', 'input[type="checkbox"]', (ev) => {
		const checkbox = ev.target;
		if (checkbox.getAttribute('id') == 'farm_multi_honnan') return;
		if (document.querySelector('#farm_multi_honnan').checked) {
			const unitType = checkbox.name;
			const newValue = checkbox.checked;
			for (let vill in SZEM4_FARM.DOMINFO_FROM) {
				SZEM4_FARM.DOMINFO_FROM[vill].isUnits[unitType] = newValue;
			}
		} else {
			SZEM4_FARM.DOMINFO_FROM[checkbox.closest('tr').cells[0].textContent].isUnits[checkbox.name] = checkbox.checked;
		}
	});
	// VIJE
	$('#vije_opts :input').on('change', (ev) => {
		const el = ev.target;
		if (el.type == 'text') {
			SZEM4_VIJE.i18ns[el.name] = el.value;
		} else if (el.type == 'checkbox') {
			SZEM4_VIJE.i18ns[el.name] = el.checked;
		}
	});
	addEventListener("visibilitychange", (event) => {
		if (document.visibilityState == 'visible') {
			const allVidEl = document.querySelectorAll('video');
			if (allVidEl.length > 0) allVidEl.forEach(vidEl => {vidEl.src&&vidEl.style.display!=='none'?vidEl.play():''})
		}
	});
});
/*
VIJE: Ha kék jeli van ahol nincs sereg, az tegye már "zölddé" a falut
Gyűjtő: Minimum teherbírás; minimum óránként nézzen már rá; stratégia: Maximum time-kor nézzen rá / azonnal / optimal
FEAT: Napló: "Bot védelem" bejegyzés hozzáadása
FEAT: csak 1 falura érvényes settings, falukijelölő (Beállítások [Összes] V Faluválasztás) + vizuális visszajelzés + reset (mindent ALL-ra)
EXTRA: Farm végére position-álj már egy "...további xxx falu"-t ha rejted
FEAT: VIJE_2 nem külön ref, hanem iframe a VIJE1-be!

Important addons
	FEAT: Építőbe "FASTEST()" és "ANY()" opció. Fastest: a leggyorsabban felépítülőt építi. Any: Amire van nyersed. Használható a kettő együtt, így "amire van nyersed, abból a leggyorsabban épülő"
	Teszt: ANY(FASTEST(MINES 25))

Essencial functions
	FEAT: Gyűjtő strat: Legkésőbbit várja/azonnal menjen
	FEAT: document.addEventListener() -- sync-elés gyűjtögetővel ill. VIJE-vel
	REFACT: VIJE: utolsó kémkedés IDEJÉT ne törölje már, max ha már csak pl. 3 napos v ilyesmi ~> "Ismeretlen/régi" is az legyen hogy ">3 napos". Nézi hogy ennél frissebb-e az elemzett jeli? + hogy az ELEMZETT-ek listájában nincs-e benne ugye
	ADDME: Farmok rendezése táv szerint

POCs
	REFACT: VIJE: Van olyan script ami csinál statot a jelikből, azt h csinálja? PF esetén csak? Lehetne használni, nem megnyitogatni egyesivel -> https://twscripts.dev/scripts/farmingEfficiencyCalculator.js
Téma
	FEAT: Jelszóvédett profil
	ADDME: Effect themes: Hozzuk be a havas témám a weboldalról, valamint legyen hullámzó víz a content tetején, átlátszó? egérre mozgó? https://jsfiddle.net/TjaBz/
Speedups/simplify/shadow modes
	ADDME: Sebesség ms-e leOKézáskor ne legyen érvényes, azt csinálja gyorsabban (konstans rnd(500ms)?)
UI 
	CONVERT: alert notification áthelyezése, +önmagától idővel eltűnő alertek
	FIXME: Header rész újra átdolgozása: több soros sok-kieg.-re felkészülés
	ADDME: Defibrillátor - minden script state-ét 0-ra állítja, mindent stop-ol majd elindítja a motorokat. Manuális lefejlesztés
	ADDME: [Lebegő ablak] PAUSE ALL, I'M OUT FOR [x] MINUTES
	ADDME: Új üzenet érkezett icon
	ADDME: Bejövők száma/Új bejövők száma icon
	
FEAT: Menetrend Switcher: Ne idő, hanem határszám alapú legyen. Input disabled legyen + kiírás. Határszám alapúnál legyen minimum vonatköz is, azaz pl. 10p-enkéntnél gyakrabban ne támadja	
FEAT: VIJE: "FARM" jelentést törli. Szóval ha kos v ilyesmi van, azt ne!
FEAT: VIJE: Silence mód: Csak színeket nézzen, színváltozás esetén nyissa csak a jelit (igen, így a kéket mindig)
FEAT: Scav -> $.getScript('https://gistcdn.githack.com/filipemiguel97/ba2591b1ae081c1cfdbfc2323145e331/raw/scavenging_legal.js') -> new strat? Mindig futtatni kell, ki kéne belezni
NEW FEATURE: Frissítse a bari listát: használja a birKer-t, nekünk csak egy számot kelljen megadni, hány mezőre keressen ~~ Helye: "Farmolandó falu hozzáadása" cells[2]-be 
ADDME: J? -> FAKE limit, és ennek figyelembe vétele
FEAT: Minden kiírt falu ami a tied, rátéve az egeret írja ki a nevét, és ha a csoportképzőbe csoporthoz van adva, akkor azt is!
FEAT: Ahol játékos van, azt a jelit ne törölje, hiába zöld a jelentés. 
ADDME: VIJE opciók: [] zöld kém nélküli jeliket törölje csak
FEAT: Építőbe TRAIN xx; épület, ami xx barakk és xx-5 istállót épít felváltva
NEW KIEG: Farmkezelő bot: Szimplán nézi a "Time"-ot, és ha user általa megadott időn belül van, akkor C-t nyom, ellenben meg A-t.
FEAT: Reset - Adatmentőbe hiányzó függvény. Az alap értékeket állítja be neki.

FEAT: VIJE: PF-el látni hogy van-e ott még nyers - ha csak arra vagyunk kíváncsiak akkor... use_this
FEAT: Kék hátteret a bányára menti, de elvileg nem kéne merthogy... tudjuk, nem?
NEW FEATURE: Ha egy parancs screen-jén futtatjuk SZEM-et, elemezze be azt, és vegye fel mint sereg (kellene hozzá támadásID lementés is?)

- Hang átdolgozás: Választó
ADDME: Saját falunál csatára készülés: Érjenek vissza xx:xx-re
ADDME: Fokozatos SZEM betöltés/indítás: preLoader (gyors beállítások), midLoader (mostani init()), endLoader (motorok indítása)
ADDME: szüneteltethető a falu támadása pipára mint a "J?" oszlop ~~> Ikon legyen: balta/ember + tooltip
ADDME: Minimalistic view: Karikába hogy SZEM4, alá heartbeat, listázni a szünetelt kiegeket, Sebesség/max táv infót?
NEW KIEG: Autoclicker: CSS leíró + perc + ALL/1st választó -> nyom rá click() eventeket
NEW KIEG: Auto katázó: Beadod mely faluból max hány percre, mely falukat. VIJE adatai alapján küldi, [] x+1 épületszintet feltételezve 1esével bontásra. [] előtte 2/4 kos v 2/6 kata falra
NEW KIEG: Auto kosozó: falszintenként 2 féle sereg-template, + max idő
ADDME: VIJE stat, h hány %-osan térnek vissza az egységek. Óránként resettelni!?
ADDME: Ai: Automatikus, falunkénti megbízhatóság- és hatászám számolás. Csak perc alapú, és farmvédő alapú
EXTRA: Pihenés sync: Ha Farmoló pihen, VIJE is (külön opció VIJE-nél: recommended ha zöld-törlése be van pipálva). Előbb VIJE, aztán farmolás!
ADDME: Signal-system: A főbb botok tudják egymásnak jelezni hogy ki dolgozik mikor, és ne üssék egymást, ill. tudjanak ezáltal adatot átdobni egymásnak
ADDME: Teherbírás módosító

FARMVÉDŐ (Nem kell, helyette jó a >fal nézés)
ADDME: New kieg.: FARMVÉDŐ (Farmolóba, opciókhoz)
minimum sereg definiálása falszintenként kísérő (ami kard, bárd, vagy kl lehet csak)+any.unit
FAL	MIN
0	80 lándzsa	4 kard+6 lándzsa	3 bárd+6 lándzsa	1 ló
1	8800lándzsa	300k+200 lándzsa	100b+50 lándzsa		4 kló	6 íló	(3nló)
2	32 kl	6kl+10íló
*/


})();
void(0);

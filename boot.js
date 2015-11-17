/*!
 * Copyright 2012-2015 Sean Hogan (http://meekostuff.net/)
 * Mozilla Public License v2.0 (http://mozilla.org/MPL/2.0/)
 */

(function() { // NOTE throwing an error or returning from this wrapper function prematurely aborts booting

var defaults = { // NOTE defaults also define the type of the associated config option
	"no_boot": false, 
	"no_intercept": false, // NOTE !(history.pushState && window.XMLHttpRequest && window.sessionStorage && window.JSON && 'readyState' in document) is enforced anyway
	"no_style": false,
	"precheck": false, // TODO false, "auto", true, "strict"
	"hidden_timeout": 3000,
	"html5_block_elements": 'article aside figcaption figure footer header hgroup main nav section',
	"html5_inline_elements": 'abbr mark output time audio video picture',
	"viewer_url": ''
}

var document = window.document;

/*
 ### console is required
 */
if (!window.console || !console.log) return; // TODO should this throw
if (!(console.info && console.warn && console.error)) {
	console.log('Interception aborting: depends on console.warn');
	return;
}

var vendorPrefix = "Meeko";

var Meeko = window.Meeko || (window.Meeko = {});

/* 
	Interception requires support for many DOM APIs. 
	Ideally we would test directly for them all up-front, 
	but many of them can be assumed based on presence of newer DOM APIs.
	Conveniently, window.MutationObserver 
	is a good proxy for many of the other features. 
		http://caniuse.com/#feat=mutationobserver
	Alternative window.Promise

	Some of the required features are:
		- native XMLHttpRequest
		- DOMParser.parseFromString(text, 'text/html')
		- history.pushState
		- inert staging documents (created by XMLHttpRequest, DOMParser, etc)
			We don't want <img>, <video> and <script> in staging documents to download 
			or run when they may be removed or changed before entering the view
		- Promise
		- MutationObserver
		- sessionStorage for saving state during reload
		- document.readyState for determining whether all landing page content
			is available.
		- element.hidden

	These features rule out browsers older than IE11, Safari6. 
	This allows us to assume the presence of features such as:
		- Node.addEventListener
		- Object.create, etc

*/

/*
 ### Get options

 TODO It would be nice if all data sources had the same API
*/

var sessionOptions = window.sessionStorage && window.JSON && (function() {

var optionsKey = vendorPrefix + '.options';
var text = sessionStorage.getItem(optionsKey);
var options = parseJSON(text);
if (typeof options !== 'object' || options === null) options = {};

return {

getItem: function(key) {
	return options[key];
},

setItem: function(key, name) {
	options[key] = name;
	sessionStorage.setItem(optionsKey, JSON.stringify(options));
}

}

})();

var dataSources = [];

function addDataSource(name, key) {
	if (!key) key = vendorPrefix + '.options';
	try { // NOTE IE10 can throw on `localStorage.getItem()` - see http://stackoverflow.com/questions/13102116/access-denied-for-localstorage-in-ie10
		// Also Firefox on `window.localStorage` - see http://meyerweb.com/eric/thoughts/2012/04/25/firefox-failing-localstorage/
		var source = window[name];
		if (!source) return;
		var options = parseJSON(source.getItem(key));
		if (options) dataSources.push( function(name) { return options[name]; } );
	} catch(error) {
		console.info(name + ' inaccessible');
	}
}

addDataSource('sessionStorage');
addDataSource('localStorage');
if (Meeko.options) dataSources.push( function(name) { return Meeko.options[name]; } )

var getData = function(name, type) {
	var data = null;
	some(dataSources, function(fn) {
		var val = fn(name);
		if (val == null) return false;
		switch (type) {
		case "string": data = val; // WARN this DOES NOT convert to String
			break;
		case "number":
			if (!isNaN(val)) data = 1 * val;
			// TODO else console.warn("incorrect config option " + val + " for " + name); 
			break;
		case "boolean":
			data = val; // WARN this does NOT convert to Boolean
			// if ([false, true, 0, 1].indexOf(val) < 0) console.warn("incorrect config option " + val + " for " + name); 
			break;
		}
		return (data !== null); 
	});
	return data;
}

var bootOptions = Meeko.bootOptions = (function() {
	var options = {};
	for (var name in defaults) {
		var def = options[name] = defaults[name];
		var val = getData(name, typeof def);
		if (val != null) options[name] = val;
	}
	return options;
})();


var searchParams = (function() {
	var search = location.search,
		options = {}; 
	if (search) search.substr(1)
		.replace(/(?:^|&)([^&=]+)=?([^&]*)/g, function(m, key, val) {
			val = (val) ? decodeURIComponent(val) : true;
			options[key] = val;
		});
	return options;
})();

function isSet(option) {
	if (searchParams[option] || bootOptions[option]) return true;
}


/*
 ## Startup
*/

if (document.body) console.warn("Interception boot-script MUST be in <head> and MUST NOT have @async or @defer");

// Don't even begin startup if "no_boot" is one of the search options (or true in Meeko.options)
if (isSet('no_boot')) return;

html5prepare(); 


if (isSet('no_style')) {
	domReady(function() {
		var parent = selfMarker.parentNode;
		nextSiblings(selfMarker, function(node) {
			switch (getTagName(node)) {
			case 'style': break;
			case 'link':
				if (/\bSTYLESHEET\b/i.test(node.rel))  break;
				return;
			default: return;
			}
			parent.removeChild(node);
		});
	});
	return;	
}

var no_intercept = isSet('no_intercept');
if (no_intercept) return; // TODO console.info()

var precheck = bootOptions['precheck'];
if (precheck !== false) {
	// TODO prechecking will require service-workers and therefore https: unless localhost
	console.warn('Prechecking is not implemented. Ignoring non-false "precheck" option');
}

/*
	HTML_IN_DOMPARSER indicates if DOMParser supports 'text/html' parsing. Historically only Firefox did.
	This seems to have cross-browser support:
		https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#Browser_compatibility
*/
var HTML_IN_DOMPARSER = (function() {

	try {
		var doc = (new DOMParser).parseFromString('', 'text/html');
		return !!doc;
	}
	catch(err) { return false; }

})();

if (!(history.pushState && 
	HTML_IN_DOMPARSER && window.XMLHttpRequest && 'readyState' in document && 
	'hidden' in document.documentElement && 
	window.sessionStorage && window.JSON &&
	window.Promise && window.MutationObserver)) {
	console.info('Interception aborting: depends on history.pushState, DOMParser HTML support, native XMLHttpRequest, sessionStorage, JSON, Promise and MutationObserver');
	return;
}


var viewerURL;

var manifestURL = (function() { // TODO call this function by name

var manifestURL = '';

var manifestHref = document.documentElement.getAttribute('manifest');
if (!manifestHref) {
	console.warn('Interception "viewer_url" SHOULD have a default set with <html manifest="...">');
}
else if (/\.appcache$/i.test(manifestHref)) {
	console.warn('Interception default "viewer_url" in <html manifest="..."> MUST NOT end with ".appcache": ', manifestHref);
}
else manifestURL = resolveURL(manifestHref);

return manifestURL;

})();

var viewerHref = bootOptions['viewer_url'];
if (viewerHref) {
	viewerURL = resolveURL(viewerHref);
	if (viewerURL !== viewerHref && !/^\//.test(viewerHref)) {
		console.error('Interception aborting: "viewer_url" option MUST be absolute URL or absolute path: ', viewerHref);
		return;
	}
}

if (!viewerURL) {
	viewerURL = manifestURL;
	if (!viewerURL) {
		console.error('Interception aborting: "viewer_url" option is not set');
		return;
	}
}


var origin = location.protocol + '//' + location.host;
if (viewerURL.indexOf(origin) !== 0) {
	console.error('Interception aborting: "viewer_url" option MUST be on same origin as current page: ', viewerHref);
	return;
}
redirect(viewerURL, true);
return;

/*
 ### JS utilities
 */
function some(a, fn, context) { 
	for (var n=a.length, i=0; i<n; i++) if (fn.call(context, a[i], i, a)) return true;
	return false;
}
function forEach(a, fn, context) { for (var n=a.length, i=0; i<n; i++) fn.call(context, a[i], i, a); }

function words(text) { return text.split(/\s+/); }

function parseJSON(text) { // NOTE this allows code to run. This is a feature, not a bug. I think.
	try { return ( Function('return ( ' + text + ' );') )(); }
	catch (error) { return; }
}

/*
 ### DOM utilites
 */
function resolveURL(relURL) {
	var a = document.createElement('a');
	a.setAttribute('href', relURL);
	return a.href;
}


/*
 ### other utilities
*/
function html5prepare() {

var blockTags = words(bootOptions['html5_block_elements']);
var inlineTags = words(bootOptions['html5_inline_elements']);

return worker();

function worker(doc) {
	if (!doc) {
		doc = document;
		addStyles();
	}
	forEach(blockTags.concat(inlineTags), function(tag) {
		tag = tag.toUpperCase(); // NOTE https://github.com/aFarkas/html5shiv/issues/54
		doc.createElement(tag); 
	});
	return doc;
}

function addStyles() {
	if (blockTags.length <= 0) return; // FIXME add a test for html5 support. TODO what about inline tags?

	var cssText = blockTags.join(', ') + ' { display: block; }\n';

	var head = document.head;
	var style = document.createElement("style");
	if ('textContent' in style) style.textContent = cssText; // standard: >=IE9
	else { // legacy: <=IE8
		var fragment = document.createDocumentFragment();
		fragment.appendChild(style); // NOTE on IE this realizes style.styleSheet 
		style.styleSheet.cssText = cssText;
	}
	
	head.insertBefore(style, head.firstChild);
}

}

function redirect(url, hide) {
	// redirect to viewer document
	console.info('Interception redirecting to viewer document');
	if (hide) document.documentElement.style.visibility = 'hidden';
	location.replace(url);
}


})();

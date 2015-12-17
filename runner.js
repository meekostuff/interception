/*!
 JS and Promise utils
 (c) Sean Hogan, 2008,2012,2013,2014,2015
 Mozilla Public License v2.0 (http://mozilla.org/MPL/2.0/)
*/

(function() {

/*
 ### Utility functions
 These might (or might not) be lodash equivalents
 */

var Meeko = this.Meeko || (this.Meeko = {});
Meeko.stuff = {};

// TODO do string utils needs to sanity check args?
var uc = function(str) { return str ? str.toUpperCase() : ''; }
var lc = function(str) { return str ? str.toLowerCase() : ''; }

var includes = function(a, item) {
	for (var n=a.length, i=0; i<n; i++) if (a[i] === item) return true;
	return false;
}

var forEach = function(a, fn, context) { for (var n=a.length, i=0; i<n; i++) fn.call(context, a[i], i, a); }

var some = function(a, fn, context) { for (var n=a.length, i=0; i<n; i++) { if (fn.call(context, a[i], i, a)) return true; } return false; }

var every = function(a, fn, context) { for (var n=a.length, i=0; i<n; i++) { if (!fn.call(context, a[i], i, a)) return false; } return true; }

var map = function(a, fn, context) {
	var output = [];
	for (var n=a.length, i=0; i<n; i++) {
		var value = a[i];
		output[i] = fn ? 
			fn.call(context, value, i, a) :
			value;
	}
	return output;
}

var filter = function(a, fn, context) {
	var output = [];
	for (var n=a.length, i=0; i<n; i++) {
		var success = fn.call(context, a[i], i, a);
		if (success) output.push(a[i]);
	}
	return output;
}

var find = function(a, fn, context) {
	for (var n=a.length, i=0; i<n; i++) {
		var item = a[i];
		var success = fn.call(context, item, i, a);
		if (success) return item;
	}
}

var words = function(text) { return text.split(/\s+/); }

var forIn = function(object, fn, context) {
	for (var key in object) {
		fn.call(context, object[key], key, object);
	}
}

var forOwn = function(object, fn, context) {
	var keys = Object.keys(object);
	for (var i=0, n=keys.length; i<n; i++) {
		var key = keys[i];
		fn.call(context, object[key], key, object);
	}
}

var isEmpty = function(o) { // NOTE lodash supports arrays and strings too
	if (o) for (var p in o) if (o.hasOwnProperty(p)) return false;
	return true;
}


var defaults = function(dest, src) {
	forOwn(src, function(val, key, object) {
		if (typeof this[key] !== 'undefined') return;
		this[key] = object[key];
	}, dest);
	return dest;
}

var assign = function(dest, src) {
	forOwn(src, function(val, key, object) {
		this[key] = object[key];
	}, dest);
	return dest;
}

assign(Meeko.stuff, {
	uc: uc, lc: lc, words: words, // string
	contains: includes, // FIXME deprecated
	includes: includes, forEach: forEach, some: some, every: every, map: map, filter: filter, find: find, // array
	forIn: forIn, forOwn: forOwn, isEmpty: isEmpty, defaults: defaults, assign: assign, extend: assign // object
});


var _ = Meeko.stuff;

/*
 ### extend console
	+ `console.logLevel` allows logging to be switched off
	
	NOTE:
	+ this assumes log, info, warn, error are defined
*/

var console = this.console;
if (!console.debug) console.debug = console.log;
var logLevels = _.words('all debug log info warn error none');
_.forEach(logLevels, function(level) {
	var _level = '_' + level;
	if (!console[level]) return;
	console[_level] = console[level];
});

var currentLogLevel = 'all';

Object.defineProperty(console, 'logLevel', {
	get: function() { return currentLogLevel; },
	set: function(newLevel) {
		newLevel = _.lc(newLevel);
		if (logLevels.indexOf(newLevel) < 0) return; // WARN??
		currentLogLevel = newLevel;
		var found = false;
		_.forEach(logLevels, function(level) {
			var _level = '_' + level;
			if (level === newLevel) found = true;
			if (!console[_level] || !found) console[level] = function() {};
			else console[level] = console[_level];
		});
	}
});

console.logLevel = 'warn'; // FIXME should be a boot-option
console.info('logLevel: ' + console.logLevel);


/*
 ### extend Promise
 */
var Promise = this.Promise;
	
_.defaults(Promise, {

applyTo: function(object) { // short-hand to create a PromiseResolver object
	var resolver = {}
	var promise = new Promise(function(resolve, reject) {
		resolver.resolve = resolve;
		resolver.reject = reject;
	});
	if (!object) object = promise;
	_.assign(object, resolver);
	return promise;
},

isPromise: function(object) {
	return object instanceof Promise;
},

isThenable: function(object) {
	return object && object.then && typeof object.then === 'function';
}

});


/*
 ### Async functions
   asap(fn) returns a promise which is fulfilled / rejected by fn which is run asap after the current micro-task
   delay(timeout) returns a promise which fulfils after timeout ms
   pipe(startValue, [fn1, fn2, ...]) will call functions sequentially
 */
var asap = function(value) { // FIXME asap(fn) should execute immediately
	if (Promise.isPromise(value)) return value;
	if (Promise.isThenable(value)) return Promise.resolve(value); // will defer
	if (typeof value === 'function') 
		return new Promise(function(resolve) { resolve(value()); });
	// NOTE otherwise we have a non-thenable, non-function something
	return Promise.resolve(value); // not-deferred
}

var defer = function(value) {
	if (Promise.isPromise(value)) return value.then();
	if (Promise.isThenable(value)) return Promise.resolve(value);
	if (typeof value === 'function') 
		return Promise.resolve().then(function() { value() });
	// NOTE otherwise we have a non-thenable, non-function something
	return Promise.resolve(value).then();
}

function pipe(startValue, fnList) { // TODO make more efficient with sync introspection
	var promise = Promise.resolve(startValue);
	for (var n=fnList.length, i=0; i<n; i++) {
		var fn = fnList[i];
		promise = promise.then(fn);
	}
	return promise;
}

function reduce(accumulator, a, fn, context) {
return new Promise(function(resolve, reject) {
	var length = a.length;
	var i = 0;

	process(accumulator);
	return;

	function process(acc) {
		while (i < length) {
			if (Promise.isThenable(acc)) {
				acc.then(process, reject);
				return;
			}
			try {
				acc = fn.call(context, acc, a[i], i, a);
				i++;
			}
			catch (error) {
				reject(error);
				return;
			}
		}
		resolve(acc);
	}
});
}

_.defaults(Promise, {
	asap: asap, defer: defer, pipe: pipe, reduce: reduce
});


}).call(this);

/*!
 DOM utils
 (c) Sean Hogan, 2008,2012,2013,2014
 Mozilla Public License v2.0 (http://mozilla.org/MPL/2.0/)
*/

/* NOTE
Requires some features not implemented on older browsers:
element.matchesSelector (or prefixed equivalent) - IE9+
element.querySelectorAll - IE8+
element.addEventListener - IE9+
element.dispatchEvent - IE9+
Object.create - IE9+
*/

(function() {

var window = this;
var document = window.document;

var Meeko = window.Meeko;

var _ = Meeko.stuff;

/*
 ### DOM utility functions
 */
var URL = Meeko.URL = (function() {

// TODO Ideally Meeko.URL is read-only compatible with DOM4 URL
// NOTE This could use `document.createElement('a').href = url` except DOM is too slow

var URL = function(href, base) {
	if (!(this instanceof URL)) return new URL(href, base);
	var baseURL;
	if (base) baseURL = typeof base === 'string' ? new URL(base) : base;
	init.call(this, href, baseURL);
}

var init = function(href, baseURL) {
	if (baseURL) {
		href = baseURL.resolve(href);
		_.assign(this, new URL(href));
	}
	else {
		var url = parse(href);
		for (var key in url) this[key] = url[key]; // _.assign(this, url);
		enhance(this);
	}
}

var keys = ['source','protocol','hostname','port','pathname','search','hash'];
var parser = /^([^:\/?#]+:)?(?:\/\/([^:\/?#]*)(?::(\d*))?)?([^?#]*)?(\?[^#]*)?(#.*)?$/;

var parse = ((typeof window.URL === 'function') && ('href' in window.URL.prototype)) ? 
function(href) {
	return new window.URL(href);
} :
function(href) {
	href = href.trim();
	var m = parser.exec(str);
	var url = {};
	for (var n=keys.length, i=0; i<n; i++) url[keys[i]] = m[i] || '';
	return url;
}

function enhance(url) {
	url.protocol = _.lc(url.protocol);
	url.supportsResolve = /^(http|https|ftp|file):$/i.test(url.protocol);
	if (!url.supportsResolve) return;
	if (url.hostname) url.hostname = _.lc(url.hostname);
	if (!url.host) {
		url.host = url.hostname;
		if (url.port) url.host += ':' + url.port;
	}
	if (!url.origin) url.origin = url.protocol + '//' + url.host;
	if (!url.pathname) url.pathname = '/';
	var pathParts = url.pathname.split('/'); // creates an array of at least 2 strings with the first string empty: ['', ...]
	pathParts.shift(); // leaves an array of at least 1 string [...]
	url.filename = pathParts.pop(); // filename could be ''
	url.basepath = pathParts.length ? '/' + pathParts.join('/') + '/' : '/'; // either '/rel-path-prepended-by-slash/' or '/'
	url.base = url.origin + url.basepath;
	url.nosearch = url.origin + url.pathname;
	url.nohash = url.nosearch + url.search;
	url.href = url.nohash + url.hash;
	url.toString = function() { return url.href; }
};

URL.prototype.resolve = function resolve(relHref) {
	relHref = relHref.trim();
	if (!this.supportsResolve) return relHref;
	var substr1 = relHref.charAt(0), substr2 = relHref.substr(0,2);
	var absHref =
		/^[a-zA-Z0-9-]+:/.test(relHref) ? relHref :
		substr2 == '//' ? this.protocol + relHref :
		substr1 == '/' ? this.origin + relHref :
		substr1 == '?' ? this.nosearch + relHref :
		substr1 == '#' ? this.nohash + relHref :
		substr1 != '.' ? this.base + relHref :
		substr2 == './' ? this.base + relHref.replace('./', '') :
		(function() {
			var myRel = relHref;
			var myDir = this.basepath;
			while (myRel.substr(0,3) == '../') {
				myRel = myRel.replace('../', '');
				myDir = myDir.replace(/[^\/]+\/$/, '');
			}
			return this.origin + myDir + myRel;
		}).call(this);
	return absHref;
}


return URL;

})();


var DOM = Meeko.DOM = (function() {

var getTagName = function(el) {
	return el && el.nodeType === 1 ? _.lc(el.tagName) : '';
}

var matchesSelector;
_.some(_.words('moz webkit ms o'), function(prefix) {
	var method = prefix + 'MatchesSelector';
	if (document.documentElement[method]) {
		matchesSelector = function(element, selector) { return (element && element.nodeType === 1) ? element[method](selector) : false; }
		return true;
	}
	return false;
});


var matches = matchesSelector ?
function(element, selector, scope) {
	if (scope) selector = absolutizeSelector(selector, scope);
	return matchesSelector(element, selector);
} :
function() { throw Error('matches not supported'); } // NOTE fallback

var closest = matchesSelector ?
function(element, selector, scope) {
	if (scope) selector = absolutizeSelector(selector, scope);
	for (var el=element; el && el.nodeType === 1 && el!==scope; el=el.parentNode) {
		if (matchesSelector(el, selector)) return el;
	}
	return;
} :
function() { throw Error('closest not supported'); } // NOTE fallback

function absolutizeSelector(selector, scope) { // WARN does not handle relative selectors that start with sibling selectors
	switch (scope.nodeType) {
	case 1:
		break;
	case 9: case 11:
		// TODO what to do with document / fragment
		return selector;
	default:
		// TODO should other node types throw??
		return selector;
	}
	var id = scope.id;
	if (!id) id = scope.id = uniqueId(scope);
	var scopePrefix = '#' + id + ' ';
	return scopePrefix + selector.replace(/,(?![^(]*\))/g, ', ' + scopePrefix); // COMMA (,) that is not inside BRACKETS. Technically: not followed by a RHB ')' unless first followed by LHB '(' 
}

var findId = function(id, doc) {
	if (!id) return;
	if (!doc) doc = document;
	if (!doc.getElementById) throw Error('Context for findId() must be a Document node');
	return doc.getElementById(id);
	// WARN would need a work around for broken getElementById in IE <= 7
}

var findAll = document.querySelectorAll ?
function(selector, node, scope) {
	if (!node) node = document;
	if (!node.querySelectorAll) return [];
	if (scope) {
		if (!scope.nodeType) scope = node; // `true` but not the scope element
		selector = absolutizeSelector(selector, scope);
	}
	return _.map(node.querySelectorAll(selector));
} :
function() { throw Error('findAll() not supported'); };

var find = document.querySelector ?
function(selector, node, scope) {
	if (!node) node = document;
	if (!node.querySelector) return null;
	if (scope) {
		if (!scope.nodeType) scope = node; // `true` but not the scope element
		selector = absolutizeSelector(selector, scope);
	}
	return node.querySelector(selector);
} :
function() { throw Error('find() not supported'); };

var siblings = function(conf, refNode, conf2, refNode2) {
	
	conf = _.lc(conf);
	if (conf2) {
		conf2 = _.lc(conf2);
		if (conf === 'ending' || conf === 'before') throw Error('siblings() startNode looks like stopNode');
		if (conf2 === 'starting' || conf2 === 'after') throw Error('siblings() stopNode looks like startNode');
		if (!refNode2 || refNode2.parentNode !== refNode.parentNode) throw Error('siblings() startNode and stopNode are not siblings');
	}
	
	var nodeList = [];
	if (!refNode || !refNode.parentNode) return nodeList;
	var node, stopNode, first = refNode.parentNode.firstChild;

	switch (conf) {
	case 'starting': node = refNode; break;
	case 'after': node = refNode.nextSibling; break;
	case 'ending': node = first; stopNode = refNode.nextSibling; break;
	case 'before': node = first; stopNode = refNode; break;
	default: throw Error(conf + ' is not a valid configuration in siblings()');
	}
	if (conf2) switch (conf2) {
	case 'ending': stopNode = refNode2.nextSibling; break;
	case 'before': stopNode = refNode2; break;
	}
	
	if (!node) return nodeList; // FIXME is this an error??
	for (;node && node!==stopNode; node=node.nextSibling) nodeList.push(node);
	return nodeList;
}

var contains = // WARN `contains()` means contains-or-isSameNode
document.documentElement.contains && function(node, otherNode) {
	if (node === otherNode) return true;
	if (node.contains) return node.contains(otherNode);
	if (node.documentElement) return node.documentElement.contains(otherNode); // FIXME won't be valid on pseudo-docs
	return false;
} ||
document.documentElement.compareDocumentPosition && function(node, otherNode) { return (node === otherNode) || !!(node.compareDocumentPosition(otherNode) & 16); } ||
function(node, otherNode) { throw Error('contains not supported'); };

function dispatchEvent(target, type, params) { // NOTE every JS initiated event is a custom-event
	if (typeof type === 'object') {
		params = type;
		type = params.type;
	}
	var bubbles = params && 'bubbles' in params ? !!params.bubbles : true;
	var cancelable = params && 'cancelable' in params ? !!params.cancelable : true;
	if (typeof type !== 'string') throw Error('trigger() called with invalid event type');
	var detail = params && params.detail;
	var event = document.createEvent('CustomEvent');
	event.initCustomEvent(type, bubbles, cancelable, detail);
	if (params) _.defaults(event, params);
	return target.dispatchEvent(event);
}

var managedEvents = [];

function manageEvent(type) {
	if (_.includes(managedEvents, type)) return;
	managedEvents.push(type);
	window.addEventListener(type, function(event) {
		// NOTE stopPropagation() prevents custom default-handlers from running. DOMSprockets nullifies it.
		event.stopPropagation = function() { console.warn('event.stopPropagation() is a no-op'); }
		event.stopImmediatePropagation = function() { console.warn('event.stopImmediatePropagation() is a no-op'); }
	}, true);
}


var insertNode = function(conf, refNode, node) { // like imsertAdjacentHTML but with a node and auto-adoption
	var doc = refNode.ownerDocument;
	if (doc.adoptNode) node = doc.adoptNode(node); // Safari 5 was throwing because imported nodes had been added to a document node
	switch(conf) {

	case 'before':
	case 'beforebegin': refNode.parentNode.insertBefore(node, refNode); break;

	case 'after':
	case 'afterend': refNode.parentNode.insertBefore(node, refNode.nextSibling); break;

	case 'start':
	case 'afterbegin': refNode.insertBefore(node, refNode.firstChild); break;

	case 'end':
	case 'beforeend': refNode.appendChild(node); break;

	case 'replace': refNode.parentNode.replaceChild(node, refNode); break;

	case 'empty':
	case 'contents': 
		// TODO DOM.empty(refNode);
		var child;
		while (child = refNode.firstChild) refNode.removeChild(child);
		refNode.appendChild(node);
		break;
	}
	return refNode;
}

var cloneContents = function(parentNode) {
	doc = parentNode.ownerDocument;
	var frag = doc.createDocumentFragment();
	var node;
	while (node = parentNode.firstChild) frag.appendChild(node);
	return frag;
}
	
var adoptContents = function(parentNode, doc) {
	if (!doc) doc = document;
	var frag = doc.createDocumentFragment();
	var node;
	while (node = parentNode.firstChild) frag.appendChild(doc.adoptNode(node));
	return frag;
}
	
/* 
NOTE:  for more details on how checkStyleSheets() works cross-browser see 
http://aaronheckmann.blogspot.com/2010/01/writing-jquery-plugin-manager-part-1.html
TODO: does this still work when there are errors loading stylesheets??
*/
// TODO would be nice if this didn't need to be polled
// TODO should be able to use <link>.onload, see
// http://stackoverflow.com/a/13610128/108354
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
var checkStyleSheets = function() { 
	// check that every <link rel="stylesheet" type="text/css" /> 
	// has loaded
	return _.every(DOM.findAll('link'), function(node) {
		if (!node.rel || !/^stylesheet$/i.test(node.rel)) return true;
		if (node.type && !/^text\/css$/i.test(node.type)) return true;
		if (node.disabled) return true;
		
		// handle IE
		if (node.readyState) return readyStateLookup[node.readyState];

		var sheet = node.sheet || node.styleSheet;

		// handle webkit
		if (!sheet) return false;

		try {
			// Firefox should throw if not loaded or cross-domain
			var rules = sheet.rules || sheet.cssRules;
			return true;
		} 
		catch (error) {
			// handle Firefox cross-domain
			switch(error.name) {
			case 'NS_ERROR_DOM_SECURITY_ERR': case 'SecurityError':
				return true;
			case 'NS_ERROR_DOM_INVALID_ACCESS_ERR': case 'InvalidAccessError':
				return false;
			default:
				return true;
			}
		} 
	});
}


return {
	getTagName: getTagName,
	contains: contains, matches: matches,
	findId: findId, find: find, findAll: findAll, closest: closest, siblings: siblings,
	dispatchEvent: dispatchEvent, manageEvent: manageEvent,
	cloneContents: cloneContents, adoptContents: adoptContents,
	insertNode: insertNode, 
	checkStyleSheets: checkStyleSheets
}

})();


}).call(this);
/*
 * Interceptor
 * Copyright 2012-2015 Sean Hogan (http://meekostuff.net/)
 * Mozilla Public License v2.0 (http://mozilla.org/MPL/2.0/)
 */


/* TODO
	+ hide (at runtime) / show (after stylesheets loaded)
	+ maybe `interceptor.fetch|transform|transclude` should be on `window`. 
 */

(function() {

var DEFAULT_TRANSFORM_ID = '_default';


var window = this;
var document = window.document;

var Meeko = window.Meeko;
var _ = Meeko.stuff;
var DOM = Meeko.DOM;
var URL = Meeko.URL;
var Promise = window.Promise;

/*
	domLoaded - intercepts DOMContentLoaded and window.onload
*/

var domLoaded = (function() {
// WARN this function assumes document.readyState is available

var loaded = false;
var complete = false;

var domLoaded = Promise.applyTo();

// See https://gist.github.com/shogun70/5388420 
// for testing document.readyState in different browsers
if (/loaded|complete/.test(document.readyState)) {
	loaded = true;
	domLoaded.resolve();
}
else document.addEventListener('DOMContentLoaded', onLoaded, true);

if (/complete/.test(document.readyState)) {
	complete = true;
	domLoaded.resolve();
}
else window.addEventListener('load', onComplete, true);

return domLoaded;

function onLoaded(e) {
	loaded = true;

	// now cloak the event
	if (e.stopImmediatePropagation) e.stopImmediatePropagation();
	else e.stopPropagation();

	document.removeEventListener('DOMContentLoaded', onLoaded, true);
	domLoaded.resolve();
}

function onComplete(e) {
	complete = true;
	window.removeEventListener('load', onComplete, true);

	onLoaded(e); // most of onLoaded also applies in onComplete
}


})();


/*
	historyManager
	- wrapper for `history` mostly to cloak pushState|replaceState, and popstate events
*/

var historyManager = Meeko.historyManager = (function() {

var historyManager = {};

// cloak history.pushState|replaceState
history._pushState = history.pushState;
history.pushState = function() { console.warn('history.pushState() is no-op.'); }
history._replaceState = history.replaceState;
history.replaceState = function() { console.warn('history.replaceState() is no-op.'); }

window.addEventListener('popstate', function(e) {
		if (e.stopImmediatePropagation) e.stopImmediatePropagation();
		else e.stopPropagation();
		
		return historyManager.onPopState(e.state);
	}, true);

var stateStore = {};
var currentState;
var predictedState;
var popStateHandler;

function createState(data) {
	var timeStamp = Date.now();
	var state = _.assign({}, data);
	state.timeStamp = timeStamp;
	var id = timeStamp;
	stateStore[id] = state;
	return id;
}

function lookupState(id) {
	return stateStore[id];
}

var started = false;

// FIXME historyManager methods - apart from start() - should throw until start()
_.defaults(historyManager, {

start: function(onInitialState, onPopState) { // FIXME this should call onPopState if history.state is defined
	if (started) throw Error('historyManager has already started');
	started = true;
	popStateHandler = onPopState;
	data = {
		url: document.URL,
		title: document.title
	};
	var id = this.createState(data);
	var state = lookupState(id);

	history._replaceState(state, state.title);
	currentState = id;

	return onInitialState(id);
},

onPopState: function(state) {
	var prevState = currentState;
	var nextState = state.timeStamp;
	currentState = nextState;
	predictedState = undefined;
	if (!popStateHandler) return;
	
	return popStateHandler(nextState, prevState);
},

createState: function(data) {
	try { new URL(data.url); }
	catch (err) { throw Error('createState(data) MUST receive a fully-resolved `url`'); }
	if (data.title == null) throw Error('createState(data) MUST receive a `title`');

	return createState(data);
},

getState: function(id) {
	return lookupState(id);
},

isCurrentState: function(id) {
	return currentState === id;
},

predictState: function(id) {
	if (!lookupState(id)) throw Error('Invalid state ID: ' + id);
	predictedState = id;
	return true;
},

cancelState: function(id) {
	if (currentState === id) return false;
	if (predictedState !== id) return true;
	predictedState = undefined;
	return true;
},

confirmState: function(id, useReplace) { // TODO can't confirmState during popstate
	if (currentState === id) return false;
	if (predictedState !== id) return false;
	var state = lookupState(id);
	var title = state.title;
	var url = state.url;

	if (useReplace) history._replaceState(state, title, url);
	else history._pushState(state, title, url);
	currentState = id;

	return true;
},

updateState: function(id, data) {
	var state = lookupState(id);
	var timeStamp = state.timeStamp;
	_.assign(state, data);
	state.timeStamp = timeStamp;

	stateStore[id] = state;
	if (!this.isCurrentState(id)) return;
	
	history._replaceState(state, state.title, state.url);
}

});


return historyManager;

})();


/*
	interceptor
*/

var interceptor = Meeko.interceptor = {};

// cloak location.assign|replacej
// FIXME location.assign|replace should be JS equivalents of browser functionality
location._assign = location.assign;
location.assign = function() { console.warn('location.assign() is no-op.'); }
location._replace = location.replace;
location.replace = function() { console.warn('location.replace() is no-op.'); }

var started = false;
domLoaded.then(function() { // fallback
	if (!started) interceptor.start({
		
	});
});

// FIXME interceptor methods - apart from start() - should throw until start()
_.assign(interceptor, {

scope: new URL(document.URL).base,

inScope: function(url) { 
	return url.indexOf(this.scope) === 0;
},

DEFAULT_TRANSFORM_ID: DEFAULT_TRANSFORM_ID,

start: function(options) {
	if (started) {
		console.warn('Ignoring repeated call to interceptor.start()');
		return;
	}
	started = true;

	var url = document.referrer;
	if (!url) return; // FIXME default url-to-load option??
	
	var interceptor = this;

	var stateId;
	historyManager.start(function(id) { stateId = id; });

	historyManager.updateState(stateId, {
		url: url,
		title: url
	});
	document.title = url;

	var docFu = interceptor.fetch(url);

	return Promise.pipe(domLoaded, [

	function() {
		_.forEach(_.words('click mousedown'), function(type) { // FIXME touchstart, etc

			DOM.manageEvent(type);
			window.addEventListener(type, function(e) {
				if (e.defaultPrevented) return;
				var acceptDefault = interceptor.onClick(e);
				if (acceptDefault === false) e.preventDefault();
			}, false); // onClick conditionally generates requestnavigation event

		});

		_.forEach(_.words('sbumit'), function(type) { // FIXME touchstart, etc

			DOM.manageEvent(type);
			window.addEventListener(type, function(e) {
				if (e.defaultPrevented) return;
				var acceptDefault = interceptor.onSubmit(e);
				if (acceptDefault === false) e.preventDefault();
			}, false); // onSubmit conditionally generates requestnavigation event

		});
	},

	function() { return options && options.waitUntil; },

	function() {
		if (!interceptor.getTransformer(DEFAULT_TRANSFORM_ID)) {
			interceptor.registerTransformer(DEFAULT_TRANSFORM_ID, {
				type: 'body'
			});
		}
	},
	
	function() {
		return docFu;
	},

	function(doc) {
		historyManager.updateState(stateId, {
			url: url, // not necessary - already set above
			title: doc.title
		});
		document.title = doc.title;
		return interceptor.transclude(doc, DEFAULT_TRANSFORM_ID, 'replace', document.body);
	},

	function() {
		// TODO ensure these fake events are not cloaked by the domLoaded functionality
		DOM.dispatchEvent(document, 'DOMContentLoaded');
		return wait(DOM.checkStyleSheets)
		.then(function() {
			DOM.dispatchEvent(window, 'load');
		});
	}

	]);
},

navigate: function(url, useReplace) {
	var interceptor = this;

	if (!interceptor.inScope(url)) {
		if (useReplace) location._replace(url);
		else location._assign(url);
	}

	var nextState = historyManager.createState({
		url: url,
		title: url
	});

	return Promise.pipe(null, [

	function() {
		historyManager.predictState(nextState);
		return interceptor.prerender(url, DEFAULT_TRANSFORM_ID);
	},
	function(node) {
		if (!historyManager.confirmState(nextState, useReplace)) return;
		DOM.insertNode('replace', document.body, node);
	}
	
	]);
},

transclusionCache: [],

prerender: function(url, transformId, details) {
	var interceptor = this;

	return Promise.pipe(url, [
	function(url) {
		return interceptor.fetch(url);
	},
	function(doc) {
		return interceptor.transform(doc, transformId, details);
	},
	function(node) {
		interceptor.transclusionCache.push({
			url: url,
			transform: transformId,
			details: details,
			node: node
		});
		return node;
	}
	]);
},

transclude: function(url, transformId, position, refNode, details) {
	var interceptor = this;

	return Promise.pipe(url, [
	function(url) {
		if (url.nodeType) return url;
		return interceptor.fetch(url);
	},
	function(frag) {
		return interceptor.transform(frag, transformId, details);
	},
	function(frag) {
		// FIXME fallback when content not found
		DOM.insertNode(position, refNode, frag);
	}
	]);	

},

transform: function(frag, transformId, details) {
	var interceptor = this;
	var transformerList = interceptor.getTransformer(transformId);
	return Promise.reduce(frag, transformerList, function(fragment, transformer) {
		return transformer.transform(fragment, details);
	})
	.then(function(frag) {
		if (frag.ownerDocument === document) return frag;
		// NOTE When inserting Custom-Elements into `document` 
		// Chrome doesn't call createdCallback() when adoptNode() is used
		return document.importNode(frag, true); 
	});
},

fetch: function(url) {
return new Promise(function(resolve, reject) {
	var xhr = new XMLHttpRequest;
	xhr.responseType = 'document';
	xhr.open('get', url, true);
	xhr.onload = function() {
		var xhr = this;
		if (xhr.status !== 200) { // TODO other response codes
			try { throw Error('XHR failed. url: ' + url + ' status: ' + xhr.status); }
			catch(err) { reject(err); }
		}
		normalize(xhr.response, { url: url })
		.then(resolve);
	}
	xhr.send();
});

},

onClick: function(e) { // return false means success
	var interceptor = this;

	if (e.button != 0) return; // FIXME what is the value for button in IE's W3C events model??
	if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return; // FIXME do these always trigger modified click behavior??

	// Find closest <a href> to e.target
	var linkElement = DOM.closest(e.target, 'a, [link]');
	if (!linkElement) return;
	var hyperlink;
	if (DOM.getTagName(linkElement) === 'a') hyperlink = linkElement;
	else {
		hyperlink = DOM.find('a, link', linkElement);
		if (!hyperlink) hyperlink = DOM.closest('a', linkElement);
		if (!hyperlink) return;
	}
	var href = hyperlink.getAttribute('href');
	if (!href) return; // not really a hyperlink

	var baseURL = new URL(document.URL);
	var url = baseURL.resolve(href); // TODO probably don't need to resolve on browsers that support pushstate

	// NOTE The following creates a pseudo-event and dispatches to frames in a bubbling order.
	// FIXME May as well use a virtual event system, e.g. DOMSprockets
	var details = {
		url: url,
		element: hyperlink
	}; // TODO more details?? event??

	var predicting = (e.type !== 'click');
	interceptor.triggerNavigationEvent(details.url, details, predicting);
	return false;
},

onSubmit: function(e) { // return false means success
	var interceptor = this;

	// test submit
	var form = e.target;
	if (form.target) return; // no iframe
	var baseURL = new URL(document.URL);
	var action = baseURL.resolve(form.action); // TODO probably don't need to resolve on browsers that support pushstate
	
	var details = {
		element: form
	};
	var method = _.lc(form.method);
	switch(method) {
	case 'get':
		var oURL = URL(action);
		var query = encode(form);
		details.url = oURL.nosearch + (oURL.search || '?') + query + oURL.hash;
		break;
	default: return; // TODO handle POST
	}
	
	interceptor.triggerNavigationEvent(details.url, details);
	return false;
	
	function encode(form) { // FIXME MUST match browser implementations of encode
		var data = [];
		_.forEach(form.elements, function(el) {
			if (!el.name) return;
			data.push(el.name + '=' + encodeURIComponent(el.value));
		});
		return data.join('&');
	}
},

triggerNavigationEvent: function(url, details, predicting) {
	var interceptor = this;
	var type = predicting ? 'predictnavigation' : 'requestnavigation';
	Promise.defer(function() {
		var acceptDefault = DOM.dispatchEvent(
				details.element, 
				type,
				{ detail: details.url }
			);

		if (predicting) return;

		if (acceptDefault !== false) {
			interceptor.navigate(details.url);
		}
	});
}


});


/*
	normalize() is called between html-parsing (internal) and document transformation (external function).
	TODO: maybe this should be interceptor.normalize()
*/
function normalize(doc, details) { 

	var baseURL = new URL(details.url);

	_.forEach(DOM.findAll('style', doc.body), function(node) { // TODO support <style scoped>
		doc.head.appendChild(node); // NOTE no adoption
	});
	
	_.forEach(DOM.findAll('style', doc.head), function(node) {
		// TODO the following rewrites url() property values but isn't robust
		var text = node.textContent;
		var replacements = 0;
		text = text.replace(/\burl\(\s*(['"]?)([^\r\n]*)\1\s*\)/ig, function(match, quote, url) {
				absURL = baseURL.resolve(url);
				if (absURL === url) return match;
				replacements++;
				return 'url(' + quote + absURL + quote + ')';
			});
		if (replacements) node.textContent = text;
	});

	return resolveAll(doc, baseURL);
}

/*
	resolveAll() resolves all URL attributes
	TODO: maybe this should be URL.resolveAll()
*/
var resolveAll = function(doc, baseURL) {

	return Promise.pipe(null, [

	function () {
		var selector = Object.keys(urlAttributes).join(', ');
		return DOM.findAll(selector, doc);
	},

	function(nodeList) {
		// return Promise.reduce(null, nodeList, function(dummy, el) {
		_.forEach(nodeList, function(el) {
			var tag = DOM.getTagName(el);
			var attrList = urlAttributes[tag];
			_.forOwn(attrList, function(attrDesc, attrName) {
				if (!el.hasAttribute(attrName)) return;
				attrDesc.resolve(el, baseURL);
			});
		});
	},

	function() {
		return doc;
	}

	]);

}


var urlAttributes = URL.attributes = (function() {
	
var AttributeDescriptor = function(tagName, attrName, loads, compound) {
	var testEl = document.createElement(tagName);
	var supported = attrName in testEl;
	var lcAttr = _.lc(attrName); // NOTE for longDesc, etc
	_.defaults(this, { // attrDesc
		tagName: tagName,
		attrName: attrName,
		loads: loads,
		compound: compound,
		supported: supported
	});
}

_.defaults(AttributeDescriptor.prototype, {

resolve: function(el, baseURL) {
	var attrName = this.attrName;
	var url = el.getAttribute(attrName);
	if (url == null) return;
	var finalURL = this.resolveURL(url, baseURL)
	if (finalURL !== url) el.setAttribute(attrName, finalURL);
},

resolveURL: function(url, baseURL) {
	var relURL = url.trim();
	var finalURL = relURL;
	switch (relURL.charAt(0)) {
		case '': // empty, but not null. TODO should this be a warning??
			break;
		
		default:
			finalURL = baseURL.resolve(relURL);
			break;
	}
	return finalURL;
}

}); // # end AttributeDescriptor.prototype

var urlAttributes = {};
_.forEach(_.words('link@<href script@<src img@<longdesc,<src,+srcset iframe@<longdesc,<src object@<data embed@<src video@<poster,<src audio@<src source@<src,+srcset input@formaction,<src button@formaction,<src a@+ping,href area@href q@cite blockquote@cite ins@cite del@cite form@action'), function(text) {
	var m = text.split('@'), tagName = m[0], attrs = m[1];
	var attrList = urlAttributes[tagName] = {};
	_.forEach(attrs.split(','), function(attrName) {
		var downloads = false;
		var compound = false;
		var modifier = attrName.charAt(0);
		switch (modifier) {
		case '<':
			downloads = true;
			attrName = attrName.substr(1);
			break;
		case '+':
			compound = true;
			attrName = attrName.substr(1);
			break;
		}
		attrList[attrName] = new AttributeDescriptor(tagName, attrName, downloads, compound);
	});
});

function resolveSrcset(urlSet, baseURL) {
	var urlList = urlSet.split(/\s*,\s*/); // FIXME this assumes URLs don't contain ','
	_.forEach(urlList, function(urlDesc, i) {
		urlList[i] = urlDesc.replace(/^\s*(\S+)(?=\s|$)/, function(all, url) { return baseURL.resolve(url); });
	});
	return urlList.join(', ');
}

urlAttributes['img']['srcset'].resolveURL = resolveSrcset;
urlAttributes['source']['srcset'].resolveURL = resolveSrcset;

urlAttributes['a']['ping'].resolveURL = function(urlSet, baseURL) {
	var urlList = urlSet.split(/\s+/);
	_.forEach(urlList, function(url, i) {
		urlList[i] = baseURL.resolve(url);
	});
	return urlList.join(' ');
}

return urlAttributes;

})();


var frameRate = 60;
var frameInterval = 1000/frameRate;

function wait(test) {
return new Promise(function(resolve) {
	poll(test, resolve);	
});
}

function poll(test, callback) {
	if (test()) callback();
	else setTimeout(function() { poll(test, callback); }, frameInterval);
}


// SimpleTransformer
var Transformer = function(type, template, format, options) {
	var transformer = this;
	var processor = transformer.processor = interceptor.createProcessor(type, options);
	if (template != null) processor.loadTemplate(template);
	transformer.format = format;
}

_.assign(Transformer.prototype, {

transform: function(srcNode, details) {
	var transformer = this;
	var provider = {
		srcNode: srcNode
	}
	if (transformer.format) {
		provider = interceptor.createDecoder(transformer.format);
		provider.init(srcNode);
	}
	return transformer.processor.transform(provider, details);
}

});

_.assign(interceptor, {

transformers: {},

registerTransformer: function(defId, defList) {
	if (!Array.isArray(defList)) defList = [ defList ];
	this.transformers[defId] = _.map(defList, function(def) {
		// create simple transformer
		return new Transformer(def.type, def.template, def.format, def.options);
	});
},

getTransformer: function(defId) {
	return this.transformers[defId];
},

decoders: {},

registerDecoder: function(type, constructor) {
	this.decoders[type] = constructor;
},

createDecoder: function(type, options) {
	return new this.decoders[type](options);
},

processors: {},

registerProcessor: function(type, constructor) {
	this.processors[type] = constructor;
},

createProcessor: function(type, options) {
	return new this.processors[type](options, this.filters);
},

registerFilter: function(name, fn) {
	this.filters.register(name, fn);
}

});

}).call(this); // WARN don't change. This matches var declarations at top

/*
 * Processors and Decoders
 * Copyright 2014-2015 Sean Hogan (http://meekostuff.net/)
 * Mozilla Public License v2.0 (http://mozilla.org/MPL/2.0/)
 */

/* TODO
	+ XSLT transforms (in processors.js)
 */

(function(classnamespace) {

var window = this;
var document = window.document;

var _ = Meeko.stuff;
var DOM = Meeko.DOM;
var Task = Meeko.Task;
var Promise = Meeko.Promise;
var interceptor = Meeko.interceptor;

var BodyProcessor = (function() {

function BodyProcessor(options, framesetDef) {
	this.options = options; // FIXME should be shallow copy
}

_.defaults(BodyProcessor.prototype, {

loadTemplate: function(template) {
	if (template) console.warn('"body" transforms do not use templates');
},

transform: function(provider, details) { // TODO how to use details?
	var srcNode = provider.srcNode;
	var srcDoc = srcNode.nodeType === 9 ? srcNode : srcNode.ownerDocument;
	if (srcNode === srcDoc) return srcDoc.body;
	if (srcNode === srcDoc.body) return srcNode;

	// FIXME what about ancestor-nodes of <body> or nodes in <head>
	var body = srcDoc.createElement('body');
	body.appendChild(srcNode);
	return body;
}
	
});

return BodyProcessor;
})();

interceptor.registerProcessor('body', BodyProcessor);

var MainProcessor = (function() {

function MainProcessor(options, framesetDef) {
	this.options = options; // FIXME should be shallow copy
}

_.defaults(MainProcessor.prototype, {

loadTemplate: function(template) {
	if (template) console.warn('"main" transforms do not use templates');
},

transform: function(provider, details) { // TODO how to use details?
	var srcNode = provider.srcNode;
	var srcDoc = srcNode.nodeType === 9 ? srcNode : srcNode.ownerDocument;
	var main;
	if (details.main) main = DOM.find(details.main, srcNode);
	if (!main && DOM.matches(srcNode, 'main, [role=main]')) main = srcNode;
	if (!main) main = DOM.find('main, [role=main]', srcNode);
	if (!main && srcNode === srcDoc.body) main = srcNode;
	if (!main && srcNode === srcDoc) main = srcDoc.body;
	// FIXME what about ancestor-nodes of <body> or nodes in <head>
	if (!main) main = srcNode;

	if (this.options && this.options.inclusive) return main;

	var frag = srcDoc.createDocumentFragment();
	var node;
	while (node = main.firstChild) frag.appendChild(node); // NOTE no adoption
	return frag;
}
	
});

return MainProcessor;
})();

interceptor.registerProcessor('main', MainProcessor);


var ScriptProcessor = (function() {

function ScriptProcessor(options, framesetDef) {
	this.frameset = framesetDef;
	this.options = options; // FIXME should be shallow copy
}

_.defaults(ScriptProcessor.prototype, {

loadTemplate: function(template) {
	if (!template) {
		console.warn('"script" transform template not defined');
		return;
	}
	if (!(typeof template === 'function' || typeof template.transform === 'function')) {
		console.warn('"script" transform template not valid');
		return;
	}
	this.processor = template;
},

transform: function(provider, details) {
	var srcNode = provider.srcNode;
	if (!this.processor) {
		console.warn('"script" transform template not valid');
		return;
	}
	if (typeof this.processor === 'function') 
		return this.processor(srcNode, details);
	return this.processor.transform(srcNode, details);
}
	
});


return ScriptProcessor;
})();

interceptor.registerProcessor('script', ScriptProcessor);


_.assign(classnamespace, {

BodyProcessor: BodyProcessor,
MainProcessor: MainProcessor,
ScriptProcessor: ScriptProcessor,

});


}).call(this, Meeko.interceptor);

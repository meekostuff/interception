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


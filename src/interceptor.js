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

getStateData: function(id) {
	return lookupState(id);
},

getCurrentState: function() {
	return currentState;
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
	Cache
*/
var Cache = Meeko.Cache = (function() {

var defaults = {
	match: matchRequest
}

var Cache = function(options) {
	this.store = [];
	this.options = {};
	_.assign(this.options, defaults);
	if (options) _.assign(this.options, options);
}

function matchRequest(a, b) { // default cache.options.match
	if (a.url !== b.url) return false;
	return true;
}

function getIndex(cache, request) {
	return _.findIndex(cache.store, function(item) {
		return cache.options.match(item.request, request);
	});
}

function getItem(cache, request) {
	var i = getIndex(cache, request);
	if (i < 0) return;
	return cache.store[i];
}


_.assign(Cache.prototype, {

put: function(request, response) {
	var cache = this;
	cache['delete'](request); // FIXME use a compressor that accepts this
	cache.store.push({
		request: request,
		response: response
	});
},

match: function(request) {
	var cache = this;
	var item = getItem(cache, request);
	if (item) return item.response;
},

'delete': function(request) { // FIXME only deletes first match
	var cache = this;
	var i = getIndex(cache, request);
	if (i < 0) return;
	cache.store.splice(i, 1);
}

});

return Cache;

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
	historyManager.start(
		function(initialState) { stateId = initialState; }, 
		function(nextState, prevState) {
			interceptor.popStateHandler(nextState, prevState);
		}
	);

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

		_.forEach(_.words('submit'), function(type) { // FIXME touchstart, etc

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

bfCache: {}, // FIXME this should be private or protected

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
		var prevState = historyManager.getCurrentState();
		if (!historyManager.confirmState(nextState, useReplace)) return;
		interceptor.bfCache[prevState] = {
			body: document.body
		};
		DOM.insertNode('replace', document.body, node);
	}
	
	]);
},

popStateHandler: function(nextState, prevState) {
	var interceptor = this;
	var bodyCache = interceptor.bfCache;
	bodyCache[prevState] = {
		body: document.body
	};
	var node = bodyCache[nextState].body;
	DOM.insertNode('replace', document.body, node);
},

transclusionCache: new Cache({ // FIXME should be private or protected
	match: function(a, b) {
		if (a.url !== b.url) return false;
		if (a.transform != b.transform) return false;
		if (a.main != b.main) return false;
		return true;
	}
}),

prerender: function(url, transformId, details) {
	var interceptor = this;

	var request = {
		url: url,
		transform: transformId,
		main: details && details.main
	};

	var response = interceptor.transclusionCache.match(request);
	if (response) return Promise.resolve(response.node);
		
	return Promise.pipe(url, [
	function(url) {
		return interceptor.fetch(url);
	},
	function(doc) {
		return interceptor.transform(doc, transformId, details);
	},
	function(node) {
		var response = {
			url: url,
			node: node
		}
		interceptor.transclusionCache.put(request, response);
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
	Promise.later(function() {
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


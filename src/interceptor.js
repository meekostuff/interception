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


var interceptor = Meeko.interceptor = {};

var started = false;
domLoaded.then(function() { // fallback
	if (!started) interceptor.start({
		
	});
});

_.assign(interceptor, {

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

	history.replaceState(null, url, url);
	document.title = url;

	var docFu = interceptor.fetch(url);

	return Promise.pipe(domLoaded, [

	function() {
		interceptor.manageEvent('click');
		interceptor.manageEvent('submit');
		window.addEventListener('click', function(e) {
			if (e.defaultPrevented) return;
			var acceptDefault = interceptor.onClick(e);
			if (acceptDefault === false) e.preventDefault();
		}, false); // onClick generates requestnavigation event
		window.addEventListener('submit', function(e) {
			if (e.defaultPrevented) return;
			var acceptDefault = interceptor.onSubmit(e);
			if (acceptDefault === false) e.preventDefault();
		}, false);
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
		history.replaceState(null, doc.title, url); // FIXME implement `state` management
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

managedEvents: [],

manageEvent: function(type) {
	if (_.includes(this.managedEvents, type)) return;
	this.managedEvents.push(type);
	window.addEventListener(type, function(event) {
		// NOTE stopPropagation() prevents custom default-handlers from running. DOMSprockets nullifies it.
		event.stopPropagation = function() { console.warn('event.stopPropagation() is a no-op'); }
		event.stopImmediatePropagation = function() { console.warn('event.stopImmediatePropagation() is a no-op'); }
	}, true);
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

	interceptor.triggerRequestNavigation(details.url, details);
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
	
	interceptor.triggerRequestNavigation(details.url, details);
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

triggerRequestNavigation: function(url, details) {
	Promise.defer(function() {
		var acceptDefault = DOM.dispatchEvent(
				details.element, 
				'requestnavigation', 
				{ detail: details.url }
			);

		if (acceptDefault !== false) {
			location.assign(details.url);
		}
	});
}


});


/*
	normalize() is called between html-parsing (internal) and document transformation (external function).
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

	return resolveAll(doc, baseURL, false);
}

/*
	resolveAll() resolves all URL attributes
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

});

var urlAttributes = {};
_.forEach(_.words('link@<href script@<src img@<longDesc,<src,+srcset iframe@<longDesc,<src object@<data embed@<src video@<poster,<src audio@<src source@<src,+srcset input@formAction,<src button@formAction,<src a@+ping,href area@href q@cite blockquote@cite ins@cite del@cite form@action'), function(text) {
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


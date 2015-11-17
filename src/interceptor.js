/*
 * Interceptor
 * Copyright 2012-2015 Sean Hogan (http://meekostuff.net/)
 * Mozilla Public License v2.0 (http://mozilla.org/MPL/2.0/)
 */


/* TODO
	+ hide (at runtime) / show (after stylesheets loaded)
 */

(function() {

var DEFAULT_TRANSFORM_ID = '_default';


var window = this;
var document = window.document;

var Meeko = window.Meeko;
var _ = Meeko.stuff;
var DOM = Meeko.DOM;
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
		resolve(xhr.response);
	}
	xhr.send();
});

}


});

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


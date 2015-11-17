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

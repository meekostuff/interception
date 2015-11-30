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
	dispatchEvent: dispatchEvent,
	cloneContents: cloneContents, adoptContents: adoptContents,
	insertNode: insertNode, 
	checkStyleSheets: checkStyleSheets
}

})();


}).call(this);

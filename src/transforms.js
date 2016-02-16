(function(classnamespace) {

var window = this;
var document = window.document;

var _ = Meeko.stuff;
var DOM = Meeko.DOM;
var Promise = window.Promise;

var Store = function() {
	this.clear();
}

_.assign(Store.prototype, {

clear: function() {
	this._store = Object.create(null);
},

has: function(key) {
	return key in this._store;
},

get: function(key) {
	return this._store[key];
},

set: function(key, value) {
	this._store[key] = value;
},

'delete': function(key) {
	delete this._store[key];
}

});



var filters = new Store();

_.assign(filters, {

filter: function(name, value, params) {
        var fn = this.get(name);
        // NOTE filter functions should only accept string_or_number_or_boolean
        // FIXME Need to wrap fn() to assert / cast supplied value and accept params
        var args = params.slice(0);
        args.unshift(value);
        return fn.apply(undefined, args);
}

});

var decoders = new Store();

_.assign(decoders, {

decode: function(type, srcNode, options) {
	var decoder = this.get(type);
	var provider = new decoder(options);
	provider.init(srcNode);
	return provider;
}

});

var processors = new Store();

_.assign(processors, {

create: function(type, template, options) {
	var def = this.get(type);
	var processor = new def(options, filters);
	if (template != null) processor.loadTemplate(template);
	return processor;
}

});


// SimpleTransformer
var Transformer = function(type, template, format, options) {
	var transformer = this;
	var processor = transformer.processor = processors.create(type, template, options);
	transformer.format = format;
}

_.assign(Transformer.prototype, {

transform: function(srcNode, details) {
	var transformer = this;
	var provider = {
		srcNode: srcNode
	}
	if (transformer.format) {
		provider = decoder.decode(transformer.format, srcNode);
	}
	return transformer.processor.transform(provider, details);
}

});

var transforms = new Store();

_.assign(transforms, {

transform: function(frag, transformId, details) {
	var transformerList = this.get(transformId);
	return Promise.reduce(frag, transformerList, function(fragment, transformer) {
		return transformer.transform(fragment, details);
	});
},

set: function(defId, defList) {
	if (!Array.isArray(defList)) defList = [ defList ];
	this._store[defId] = _.map(defList, function(def) {
		// create simple transformer
		return new Transformer(def.type, def.template, def.format, def.options);
	});
},

});

_.assign(classnamespace, {

filters: filters,
decoders: decoders,
processors: processors,
transforms: transforms

});


}).call(this, Meeko); // WARN don't change. This matches var declarations at top


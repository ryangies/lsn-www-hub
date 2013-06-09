// Livesite (c) Livesite Networks, LLC 2006-2013.

ECMAScript.Extend('dom',function(ecma){var _package=this;_package.ElementListener=function(selector,element,eventName,callback){this.selector=selector;this.element=element;this.callback=callback;this.eventName=eventName;ecma.dom.addEventListener(this.element,this.eventName,this.onEvent,this);};var _proto=_package.ElementListener.prototype={};_proto.remove=function(){ecma.dom.removeEventListener(this.element,this.eventName,this.onEvent,this);};_proto.onEvent=function(event){ecma.lang.callback(this.callback,this,[event,this.element]);};});ECMAScript.Extend('dom',function(ecma){this.ElementAdaptor=function(){ecma.action.ActionDispatcher.apply(this);};var _proto=this.ElementAdaptor.prototype=ecma.lang.createPrototype(ecma.action.ActionDispatcher);_proto.attach=ecma.lang.createAbstractFunction();});ECMAScript.Extend('dom',function(ecma){this.ActionAdaptor=function(){ecma.dom.ElementAdaptor.apply(this);this.keyword='action';};var _proto=this.ActionAdaptor.prototype=ecma.lang.createPrototype(ecma.dom.ElementAdaptor);_proto.createListener=function(elem,spec){var listener=null;var parts=spec.split(/:/);if(parts){var type=parts.shift();var name=parts.shift();var arg1=parts.join(':');if(type==this.keyword){listener=new ecma.dom.EventListener(elem,'click',function(){var args=ecma.util.args(arguments);var event=args.shift();var action={'name':args.shift(),'event':event,'element':elem};ecma.dom.stopEvent(event);this.executeClassAction.apply(this,[action,elem].concat(args));},this,[name,arg1]);}}
return listener;};});ECMAScript.Extend('dom',function(ecma){var _package=this;_package.elementListeners=[];this.addElementListener=function(selectors,events,callback){if(!selectors)throw new TypeError('Missing selectors');if(!events)throw new TypeError('Missing events');if(!callback)throw new TypeError('Missing callback');if(!ecma.util.isArray(selectors))selectors=[selectors];if(!ecma.util.isArray(events))events=[events];var result=[];for(var i=0;i<selectors.length;i++){var selector=selectors[i];var elements=ecma.dom.selectElements(selector,ecma.document);for(var j=0,elem;elem=elements[j];j++){for(var k=0,eventName;eventName=events[k];k++){result.push(new ecma.dom.ElementListener(selector,elem,eventName,callback));}}}
_package.elementListeners.push([selectors,events,callback]);return result;};this.adaptors={};this.addAdaptor=function(tags,adaptor){if(!tags)throw new TypeError();if(!ecma.util.isArray(tags))tags=[tags];var dispatcher=ecma.dom.dispatcher;for(var i=0;i<tags.length;i++){var tagName=tags[i];var pool=ecma.dom.adaptors[tagName];if(!pool){pool=ecma.dom.adaptors[tagName]=new ecma.data.Pool();}
adaptor.addActionListener('*',dispatcher.dispatchAction,dispatcher);pool.add(adaptor);}};this.attachAdaptors=function(rootElement){for(var selector in ecma.dom.adaptors){var pool=ecma.dom.adaptors[selector];var elements=ecma.dom.selectElements(selector,rootElement);if(rootElement.tagName==selector.toUpperCase()){elements.unshift(rootElement);}
for(var j=0,elem;elem=elements[j];j++){pool.forEach(function(adaptor){try{adaptor.attach(elem);}catch(ex){}});}}};var _createElementImpl=this.createElement;this.createElement=function(){var elem=_createElementImpl.apply(this,arguments);ecma.dom.attachAdaptors(elem);return elem;};});ECMAScript.Extend('dom',function(ecma){new ecma.dom.EventListener(ecma.window,'load',function(event){ecma.dom.attachAdaptors(ecma.dom.getBody());});});
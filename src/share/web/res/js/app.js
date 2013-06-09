// Livesite (c) Livesite Networks, LLC 2006-2013.

js.extend('lsn.app',function(js){var CPage=js.lsn.ui.Page;var CPrompt=js.lsn.ui.Prompt;this.Application=function(){CPage.apply(this);CPrompt.apply(this);this.ui=new Object();};var Application=this.Application.prototype=js.lang.createPrototype(CPage,CPrompt);Application.onPageLoad=function(event){this.attach();};Application.attach=function(){function walk(node,cb){if(!js.dom.node.isElement(node))return;js.lang.callback(cb,null,[node]);if(node.hasChildNodes()){var child=node.firstChild;while(child){walk(child,cb);child=child.nextSibling;}}}
walk(js.dom.getBody(),[this.attachElement,this]);};Application.attachElement=function(elem){if(elem.tagName=='BUTTON'){var value=js.dom.getAttribute(elem,'value');if(value){this.attachAction(elem,value);}}else if(elem.tagName=='A'){var href=js.dom.getAttribute(elem,'href');if(href){var loc=new js.http.Location(href);var hash=loc.getHash();if(hash){this.attachAction(elem,hash);}}}
var id=js.dom.getAttribute(elem,'id');if(!id)return;if(this.ui[id]){if(!js.util.isArray(this.ui[id])){this.ui[id]=[this.ui[id]];}
this.ui[id].push(elem);}else{this.ui[id]=elem;}};Application.attachAction=function(elem,spec){var listener=null;var parts=spec.split(/:/);if(parts){var type=parts.shift();if(type=='action'){listener=new js.dom.EventListener(elem,'click',function(){var args=js.util.args(arguments);var event=args.shift();js.dom.stopEvent(event);args.splice(1,0,elem);this.dispatchClassAction.apply(this,args);},this,parts);}}
return listener;};});
/**
 * The difference between a Dialog and a Popup is that when a popup is
 * displayed, the user can close it simpy by clicking on the masked background.
 */

js.extend('ux', function (js) {
  
  var CDialog = js.lsn.ui.Dialog;

  this.Popup = function (content) {
    CDialog.apply(this, arguments);
    this.makeMasked();
    this.mask.setBackground('#505050');
  };

  var _proto = this.Popup.prototype = js.lang.createMethods(CDialog);

  _proto.appear = function (cb) {
    js.dom.setOpacity(this.uiRoot, 1);
    js.lang.callback(cb);
  };

  _proto.disappear = function (cb) {
    js.dom.setOpacity(this.uiRoot, 0);
    js.lang.callback(cb);
  };

  _proto.onDialogAttach = function (action) {
    /*
    var vp = js.dom.getViewportPosition();
    this.maxWidth = vp.width - 100;
    this.maxHeight = vp.height - 100;
    */
  };

  _proto.onDialogHide = function (action) {
  };

});


js.extend('ux', function (js) {

  this.Handle = function (link) {
    this.link = link;
    this.dialog = new js.ux.Popup();
    this.dialog.setContents(this.getContentElement());
    this.evtClick = new js.dom.EventListener(this.link, 'click', this.onClick, this);
  };

  var Handle = this.Handle.prototype = js.lang.createMethods();

  Handle.getContentElement = function () {
    var loc = new js.http.Location(js.dom.getAttribute(this.link, 'href'));
    var id = loc.getHash();
    return js.dom.getElement(id);
  };

  Handle.onClick = function (event) {
    js.dom.stopEvent(event);
    this.dialog.show();
  };

});

js.extend('ux', function (js) {

  this.attachPopupLinks = function () {
    var links = js.dom.getAnchorsByRel(js.dom.getBody(), 'popup');
    for (var i = 0, link; link = links[i]; i++) {
      new js.ux.Handle(link);
    }
  };

});

js.dom.addEventListener(js.document, 'load', js.ux.attachPopupLinks);

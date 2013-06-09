/**
 * The difference between a Dialog and a Popup is that when a popup is
 * displayed, the user can close it simpy by clicking on the masked background.
 */

js.extend('lsn.adaptors.popup.image', function (js) {
  
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

});

js.extend('lsn.adaptors.popup.image', function (js) {
  
  var CPopup = js.lsn.adaptors.popup.image.Popup;

  this.ImageDialog = function (content) {
    CPopup.apply(this, arguments);
  };

  var _proto = this.ImageDialog.prototype = js.lang.createMethods(CPopup);

  _proto.load = function () {
    this.setContents(js.dom.getElement('viewimgPreload'));
  };

  _proto.show = function (img, titleText) {
    this.img = img;
    this.titleText = titleText || '';
    CPopup.prototype.show.call(this);
  };

  _proto.onDialogAttach = function (action) {
    js.dom.replaceChildren('viewimgImage', [this.img]);
    var title = js.dom.createElement('#text', {'nodeValue': this.titleText});
    js.dom.replaceChildren('viewimgTitle', [title]);
  };

  _proto.onDialogHide = function (action) {
    js.dom.removeChildren('viewimgImage');
    this.img = null;
    this.titleText = null;
  };

});

js.extend('lsn.adaptors.popup.image', function (js) {

  function _resize (nx, ny, max_x, max_y) {
    var w = nx;
    var h = ny;
    if (max_x > 0) {
      if (nx > max_x) {
        var ratio = ny/nx;
        var reduce_x = nx - max_x;
        var reduce_y = reduce_x * ratio;
        w = nx - reduce_x;
        h = ny - reduce_y;
        nx = w;
        ny = h;
      }
    }
    if (max_y > 0) {
      if (ny > max_y) {
        var ratio = nx/ny;
        var reduce_y = ny - max_y;
        var reduce_x = reduce_y * ratio;
        w = nx - reduce_x;
        h = ny - reduce_y;
        nx = w;
        ny = h;
      }
    }
    return [nx, ny];
  }

  this.Thumb = function (link, imageDialog) {
    this.imageDialog = imageDialog;
    this.link = link;
    this.img = null;
    this.maxWidth = 800;
    this.maxHeight = 600;
    this.thumb = this.getImageFromLink();
    if (this.thumb && this.link) {
      js.dom.addEventListener(this.link, 'click', this.onShowImage, this);
    }
  };

  var Thumb = this.Thumb.prototype = js.lang.createMethods();

  Thumb.getImageFromLink = function () {
    var img = null;
    var node = this.link.firstChild;
    while (node) {
      if (js.dom.node.isElement(node) && node.tagName == 'IMG') {
        img = node;
        break;
      }
      node = node.nextSibling;
    }
    return img;
  };

  Thumb.onShowImage = function (event) {
    js.dom.stopEvent(event);
    var vp = js.dom.getViewportPosition();
    this.maxWidth = vp.width - 100;
    this.maxHeight = vp.height - 100;
    var uri = this.link.href + '?resize=' + this.maxWidth + 'x' + this.maxHeight;
    this.img = js.dom.createElement('IMG', {
      'src': uri,
      'onLoad': [this.onImageLoad, this],
      'border': 0
    });
  };

  Thumb.onImageLoad = function (event) {
    var dims = _resize(this.img.width, this.img.height, this.maxWidth, this.maxHeight);
    js.dom.setAttribute(this.img, 'width', dims[0]);
    js.dom.setAttribute(this.img, 'height', dims[1]);
    var titleText = js.dom.getAttribute(this.thumb, 'alt') ||
      js.dom.getAttribute(this.link, 'title') || '';
    this.imageDialog.show(this.img, titleText);
  };

});

js.extend('lsn.adaptors.popup.image', function (js) {

  var _imageDialog = new js.lsn.adaptors.popup.image.ImageDialog();

  this.attachImageLinks = function (rel) {
    var links = js.dom.getAnchorsByRel(js.dom.getBody(), rel || 'thumb');
    for (var i = 0, link; link = links[i]; i++) {
      new js.lsn.adaptors.popup.image.Thumb(link, _imageDialog);
    }
  };

});

js.extend('photo', function (js) {

  CAction = js.action.ActionDispatcher;

  this.Viewer = function () {
    CAction.apply(this);
    this.thumbs = new js.data.Node();
    this.mask = new js.lsn.Mask({'background-color':'#555'});
    this.isVisible = false;
    js.dom.addEventListener(this.mask.getElement(), 'click', this.hide, this);
    js.dom.addEventListener(window, 'resize', this.updateUI, this);
  }

  var _proto = this.Viewer.prototype = js.lang.createMethods(
    CAction
  );

  _proto.attach = function (elem) {
    var anchors = js.dom.getElementsByTagName(elem, 'A');
    for (var i = 0, a; a = anchors[i]; i++) {
      var rel = js.dom.getAttribute(a, 'rel');
      if (rel && rel.match(/^thumb/)) {
        var loc = new js.http.Location(a.href);
        var image = new js.photo.Image(loc.pathname);
        var thumb = this.thumbs.appendChild(image);
        js.dom.addEventListener(a, 'click', this.onThumbClick, this, [thumb]);
      }
    }
  };

  _proto.getElement = function () {
    return this.uiRoot || this.createUI();
  };

  _proto.createUI = function () {
    this.uiPhotoArea = js.dom.createElement('div');
    this.uiButtonArea = this.createButtonArea();
    this.uiRoot = js.dom.createElement('div', {
      'onClick':[this.hide, this],
      'style': {
        'position':'absolute',
        'text-align':'center',
        'z-index':1
      }
    }, [
      this.uiPhotoArea,
      this.uiButtonArea
    ]);
    return this.uiRoot;
  };

  _proto.updateUI = function () {
    var vp = js.dom.getViewportPosition();
    var t = 50;
    var l = 50;
    this.w = vp.width - (2*l);
    this.h = vp.height - (2*t);
    if (this.w < 0 || this.h < 0) throw 'not enough area';
    js.dom.setStyles(this.getElement(), {
      'width':this.w + 'px',
      'height':this.h + 'px',
      'top':(vp.top + t) + 'px',
      'left':(vp.left + l)  + 'px'
    });
    js.dom.setStyles(this.uiButtonArea, {
      'width':this.w + 'px'
    });

  };

  _proto.createButtonArea = function () {
    var div = js.dom.createElement('div', {
      'style': {
        'height': '25px',
        'position': 'absolute',
        'text-align': 'center',
        'left': '0px',
        'top': '-25px',
        'z-index': 2
      }
    }, [
      'button=&laquo;', {'onClick': [this.onPrevClick, this], 'title': 'Previous'},
      'button=&times;', {'onClick': [this.hide, this], 'title': 'Close'},
      'button=&raquo;', {'onClick': [this.onNextClick, this], 'title': 'Next'}
    ]);
    return div;
  };

  _proto.onThumbClick = function (event, thumb) {
    if (this.show(thumb)) {
      js.dom.stopEvent(event);
    }
  };

  _proto.onPrevClick = function (event) {
    js.dom.stopEvent(event);
    if (!this.active) return;
    var thumb = this.active.previousSibling;
    if (!thumb) return;
    this.show(thumb);
  };

  _proto.onNextClick = function (event) {
    js.dom.stopEvent(event);
    if (!this.active) return;
    var thumb = this.active.nextSibling;
    if (!thumb) return;
    this.show(thumb);
  };

  _proto.show = function (thumb) {
    if (!this.isVisible) {
      this.mask.show();
      try {
        this.updateUI();
        js.dom.appendChild(js.dom.getBody(), this.uiRoot);
      } catch (ex) {
        this.mask.hide();
        return false;
      }
      this.isVisible = true;
    }
    thumb.data.setDimensions(this.w, this.h);
    js.dom.replaceChildren(this.uiPhotoArea, [thumb.data.getElement()]);
    this.active = thumb;
    return true;
  };

  _proto.hide = function () {
    this.mask.hide();
    js.dom.removeElement(this.uiRoot);
    this.isVisible = false;
  };

});

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

js.extend('photo', function (js) {

  CPerlModule = js.http.PerlModule;

  this.Image = function (addr) {
    CPerlModule.call(this, '/res/html/photo/module.pm');
    this.addr = addr;
    this.width = 0;
    this.height = 0;
    this.alt = '';
    this.uiRoot = undefined;
    this.isReady = true;
  };

  var _proto = this.Image.prototype = js.lang.createMethods(CPerlModule);

  _proto.setIsReady = function (state) {
    this.isReady = !!state;
    if (state) {
      js.dom.addClassName(this.getElement(), 'ready');
    } else {
      js.dom.removeClassName(this.getElement(), 'ready');
    }
  };

  _proto.setDimensions = function (maxWidth, maxHeight) {
    this.setIsReady(false);
    js.dom.removeClassName(this.getElement(), 'ready');
    var params = {
      'addr': this.addr,
      'width': maxWidth,
      'height': maxHeight
    };
    this.submit('get_image_info', params, this.setImageInfo);
  };

  _proto.setImageInfo = function (data) {
    if (data) {
      var info = data.toObject();
      this.width = info.width;
      this.height = info.height;
      this.src = this.addr + '?resize=' + this.width + 'x' + this.height;
    }
    this.setIsReady(true);
    this.updateUI();
  };

  _proto.getElement = function () {
    return this.uiRoot || this.createUI();
  };

  _proto.createUI = function () {
    var props = {
      'alt': this.alt,
      'border': 0
    }
    this.uiRoot = js.dom.createElement('img', props);
    return this.updateUI();
  };

  _proto.updateUI = function () {
    if (!(this.isReady && this.uiRoot)) return this.uiRoot;
    var props = {};
    if (this.src) {
      props.src = this.src;
      props.width = this.width;
      props.height = this.height;
    } else {
      props.src = this.addr;
    }
    for (var k in props) {
      js.dom.setAttribute(this.uiRoot, k, props[k]);
    }
    return this.uiRoot;
  };

});


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

/*

  These CSS class names (and variables of layout.dims) are updated when the 
  window is loaded and resized:

   _________________________________         _      _
  |                                 | _       | h1a  | h1
  |                                 |  | h2a  |      |
  |                                 | _|      |      |
  |=================================|        =| h1b  |
  |                                 | _       | h1c  |
  |                                 | _| h2b  |      |
  |_________________________________|        _|     _|

   |_______________________________| 
   w2
  |_________________________________|
  w1

*/

ECMAScript.Extend('local', function (ecma) {
  // Page layout (dimensions) which updates on resize
  this.layout = new ecma.lsn.PageLayout({

    dims: {
      htop:   0,
      ratio:  0,
      w1:     0,
      w2:     0,
      h1:     0,
      h1a:    0,
      h1b:    0,
      h1c:    0,
      h2a:    0,
      h2b:    0
    },

    extensions: [],

    extend: function (func) {
      this.extensions.push(func);
    },

    load: function (event) {
      var vp = ecma.dom.getViewportPosition();
      var h1 = ecma.util.asInt(Math.max(vp.height/2.5, [#topmin]));
      this.dims.ratio = (h1/vp.height).toFixed(2);
      this.css = new ecma.dom.StyleSheet();
      this.dims.h1b = [#resize-height];
      this.css.updateRule('.h1b', {height: ecma.util.asInt(this.dims.h1b, true) + 'px'});
      this.css.updateRule('.m1', {margin: '[#pad]px'});
      this.resize();
    },

    resize: function (event) {
      var vp = ecma.dom.getViewportPosition();
      this.dims.htop = ecma.util.asInt(Math.max(vp.height * this.dims.ratio, [#topmin]));
      if (this.dims.htop >= vp.height) return;
      this.dims.w1 = vp.width;
      this.dims.w2 = vp.width - (2*[#pad]);
      this.dims.h1 = vp.height;
      this.dims.h1a = this.dims.htop;
      this.dims.h1c = this.dims.h1 - this.dims.h1a - this.dims.h1b;
      this.dims.h2a = this.dims.h1a - (2*[#pad]);
      this.dims.h2b = this.dims.h1c - (2*[#pad]);
      for (var i = 0, func; func = this.extensions[i]; i++) {
        func.apply(this, [event]);
      }
      for (var k in this.dims) {
        var v = ecma.util.asInt(this.dims[k], true) + 'px';
        var c = k.substr(0,1);
        var name = '.' + k;
        var prop =
          c == 'w' ? 'width' :
          c == 'h' ? 'height' : k;
        var rule = {};
        rule[prop] = v;
        this.css.updateRule(name,  rule);
      }
    },

    unload: function (event) {
    }

  });
});

js.dom.addEventListener(js.window, 'load', function () {
  new js.lsn.DragHandle('hsplitsep', {
    'onMouseMove': function (event, dh) {
      js.local.layout.dims.ratio = ((dh.o_h1 + dh.delta_y) / dh.pg_h).toFixed(2);
      js.local.layout.resize();
      js.dom.stopEvent(event);
    },
    'onMouseDown': function (event, dh) {
      dh.pg_h = js.dom.getViewportPosition().height;
      dh.o_h1 = js.local.layout.dims.htop;
      js.lsn.showMask({opacity:0,cursor:'n-resize'});
      js.dom.stopEvent(event);
    },
    'onMouseUp': function (event, dh) {
      js.lsn.hideMask();
      js.dom.stopEvent(event);
    }
  });
});

__DATA__

# Minimum height for top section
topmin => 100

# Height of the horizontal resize bar
resize-height => 5

# Panel padding
pad => 5

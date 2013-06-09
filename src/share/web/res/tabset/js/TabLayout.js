ECMAScript.Extend('res.tabset', function (ecma) {

  var CPageLayout = ecma.lsn.PageLayout;
  var proto = ecma.lang.createMethods(CPageLayout);

  this.TabLayout = function (tabset) {
    CPageLayout.apply(this);
    this.tabset = tabset;
    this.css = new ecma.dom.StyleSheet();
    this.g_w2 = null; // Controlling width
    this.dh = new ecma.lsn.DragHandle('hsplit', {
      'onMouseMove': [this.dhMove, this],
      'onMouseDown': [this.dhMouseDown, this],
      'onMouseUp': [this.dhMouseUp, this]
    });
    this.dims = {
      w2: .2, // left-hand width is 20%
      w2min: 200, // but no smaller than 200px
      h2: 25, // tabs are 25px high
      w4: [#./styles.css/hsplit.sz],
      h1: ecma.dom.getTop('tab-frame'),
      nav_w: [#./styles.css/tabnav.sz]
    };
  };

  this.TabLayout.prototype = proto;

  proto.rightHandOnly = function () {
    this.dims.w2 = 0;
    this.dims.w2min = 0;
    this.dims.w4 = 0;
    delete this.dh;
    this.g_w2 = null;
    ecma.dom.setStyle('hsplit', 'display', 'none');
  };

  proto.resize = function (event) {
    var vp = ecma.dom.getViewportPosition();
    var pg_w = vp.width;
    var pg_h = vp.height;
    var w1 = pg_w;
    if (!ecma.util.defined(this.g_w2)) {
      this.g_w2 = ecma.util.asInt(Math.max((w1 * this.dims.w2), this.dims.w2min));
    }
    var w2 = this.g_w2;
    var w3 = w1 - w2;
    var w2a = w2 - this.dims.w4;
    var w2b = w2a - this.dims.nav_w;
    var w3a = w3 - this.dims.nav_w;
    var h2 = this.dims.h2;
    var h3 = pg_h - this.dims.h1 - h2;
    this.css.updateRule('.w1',  {'width':   ecma.util.asInt(w1, true)   + 'px'});
    this.css.updateRule('.w2',  {'width':   ecma.util.asInt(w2, true)   + 'px'});
    this.css.updateRule('.w2a', {'width':   ecma.util.asInt(w2a, true)  + 'px'});
    this.css.updateRule('.w2b', {'width':   ecma.util.asInt(w2b, true)  + 'px'});
    this.css.updateRule('.w3',  {'width':   ecma.util.asInt(w3, true)   + 'px'});
    this.css.updateRule('.w3a', {'width':   ecma.util.asInt(w3a, true)  + 'px'});
    this.css.updateRule('.h1',  {'height':  ecma.util.asInt(this.dims.h1, true)   + 'px'});
    this.css.updateRule('.h2',  {'height':  ecma.util.asInt(h2, true)   + 'px'});
    this.css.updateRule('.h3',  {'height':  ecma.util.asInt(h3, true)   + 'px'});
    this.css.updateRule('.l1',  {'left':    ecma.util.asInt(0, true)    + 'px'});
    [#:if ./styles.css/orientation eq 'ltr']
    this.css.updateRule('.l2',  {'left':    ecma.util.asInt(w2a, true)  + 'px'});
    [#:else]
    this.css.updateRule('.l2',  {'right':   ecma.util.asInt(w2a + this.dims.w4, true)  + 'px'});
    [#:end if]
    this.css.updateRule('.l3',  {'left':    ecma.util.asInt(w2, true)   + 'px'});
    this.css.updateRule('.l4',  {'left':    ecma.util.asInt(w3, true)   + 'px'});
    this.css.updateRule('#lh-tabs', {'width': ecma.util.asInt(w2b, true)    + 'px'});
    this.css.updateRule('#rh-tabs', {'width': ecma.util.asInt(w3a, true)    + 'px'});
    this.css.updateRule('#lh-tab-nav', {'left': ecma.util.asInt(w2 - this.dims.nav_w, true)    + 'px'});
    this.css.updateRule('#rh-tab-nav', {'right': ecma.util.asInt(0, true)    + 'px'});
  };

  proto.dhMove = function (event, dh) {
    var new_w2 = dh.o_w2 + dh.delta_x;
    if (new_w2 < this.dims.w2min || new_w2 > dh.w2_max) return;
    this.g_w2 = dh.o_w2 + dh.delta_x;
    this.resize();
    this.tabset.updateUI();
    ecma.dom.stopEvent(event);
  };

  proto.dhMouseDown = function (event, dh) {
    var vp = ecma.dom.getViewportPosition();
    var pg_w = vp.width;
    dh.o_w2 = this.g_w2;
    dh.w2_max = pg_w - this.dims.w2min;
    if (ecma.dom.browser.isIE) {
      // IE 6 needs the frames hidden to avoid eating mouse events
      var iframes = document.getElementsByTagName('iframe');
      dh.modlist = [];
      for (var i = 0; i < iframes.length; i++) {
        var f = iframes[i];
        if (f.style.visibility != 'hidden') {
          f.style.visibility = 'hidden';
          dh.modlist.push(f);
        }
      }
    } else {
      ecma.lsn.showMask({opacity:0,cursor:'e-resize'});
    }
    ecma.dom.stopEvent(event);
  };

  proto.dhMouseUp = function (event, dh) {
    if (ecma.dom.browser.isIE) {
      // IE 6 needs the frames hidden to avoid eating mouse events
      for (var i = 0; dh.modlist && i < dh.modlist.length; i++) {
        dh.modlist[i].style.visibility = 'visible';
      }
    } else {
      ecma.lsn.hideMask();
    }
    ecma.dom.stopEvent(event);
  };

});

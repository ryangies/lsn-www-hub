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

ECMAScript.Extend('res.tabset', function (ecma) {

  var STATE_HIDDEN = 1;
  var STATE_SHOW_NEXT = 2;
  var STATE_SHOW_PREVIOUS = 3;
  var STATE_SHOW_NEXT_AND_PREVIOUS = 4;

  var proto = {};

  this.TabNav = function (eNav, eTabs) {
    this.eNav = ecma.dom.getElement(eNav);
    this.eTabs = ecma.dom.getElement(eTabs);
    this.row = 0;
    this.createUI();
    this.updateUI();
  };

  this.TabNav.prototype = proto;

  proto.createUI = function () {
    if (!this.ui) this.ui = new Object();
    this.delta = 25;
    this.ui.prev = ecma.dom.createElement('img', {
      'src': '[#`./images/nav-up.png`]',
      'class': 'go-previous',
      'border': 0,
      'width': '8px',
      'height': '16px',
      'onclick': [this.goPrevious, this]
    });
    this.ui.next = ecma.dom.createElement('img', {
      'src': '[#`./images/nav-down.png`]',
      'class': 'go-next',
      'border': 0,
      'width': '8px',
      'height': '16px',
      'onclick': [this.goNext, this]
    });
    ecma.dom.appendChildren(this.eNav, [this.ui.prev, this.ui.next]);
  };

  proto.updateUI = function () {
    var rows = this.getRowCount();
    while (rows > 0 && this.row >= rows) {
      this.scrollToRow(--this.row);
    }
    if (rows > 1) {
      if (this.row == 0) {
        this.setState(STATE_SHOW_NEXT);
      } else {
        if (this.row + 1 == rows) {
          this.setState(STATE_SHOW_PREVIOUS);
        } else {
          this.setState(STATE_SHOW_NEXT_AND_PREVIOUS);
        }
      }
    } else {
      this.setState(STATE_HIDDEN);
    }
  };

  proto.goPrevious = function () {
    if (this.row - 1 < 0) return;
    this.scrollToRow(--this.row);
    this.updateUI();
  };

  proto.goNext = function () {
    if (this.row + 1 >= this.getRowCount()) return;
    this.scrollToRow(++this.row);
    this.updateUI();
  };

  proto.getRowCount = function () {
    var h = ecma.dom.getHeight(this.eTabs);
    return ecma.util.asInt(h/this.delta);
  };

  proto.scrollToRow = function (row) {
    var t = row * this.delta;
    ecma.dom.setStyle(this.eTabs, 'top', -t + 'px');
  };

  proto.setState = function (state) {
    if (this.state == state) return;
    this.state = state;
    if (state == STATE_HIDDEN) {
      ecma.dom.addClassName(this.ui.prev, 'hidden');
      ecma.dom.addClassName(this.ui.next, 'hidden');
    } else if (state == STATE_SHOW_NEXT) {
      ecma.dom.addClassName(this.ui.prev, 'hidden');
      ecma.dom.removeClassName(this.ui.next, 'hidden');
    } else if (state == STATE_SHOW_PREVIOUS) {
      ecma.dom.removeClassName(this.ui.prev, 'hidden');
      ecma.dom.addClassName(this.ui.next, 'hidden');
    } else if (state == STATE_SHOW_NEXT_AND_PREVIOUS) {
      ecma.dom.removeClassName(this.ui.prev, 'hidden');
      ecma.dom.removeClassName(this.ui.next, 'hidden');
    }
  };

});

/** @namespace res */
ECMAScript.Extend('res.tabset', function(ecma) {

  var _defaultTab = {
    id: '',
    name: '',
    src: '',
    side: 'right',
    reloadOnClick: false, // TODO
    canClose: false,
    icon: undefined,
    loadInBackground: false
  };

  /** @class Tab */

  this.Tab = function (tabset, props) {
    this.props = ecma.util.overlay({}, _defaultTab, props);
    this.id = props.id;
    this.tabset = tabset;
    this.hasSelected = false;
    this.ui = {};
    this.tabElem = ecma.dom.createElement('li', {
      'onClick': [this.select, this],
      'class': 'tab'
    });
    var tabContent = ecma.dom.createElement('div', {'class':'inner'});
    if (this.props.icon) {
      this.ui.icon = ecma.dom.createElement('img', {
        'src': this.props.icon,
        'class': 'icon-img'
      });
      tabContent.appendChild(this.ui.icon);
    }
    this.ui.name = ecma.dom.createElement('span.tabname', {
      'innerHTML': 'Loading...'
    });
    tabContent.appendChild(this.ui.name);
    if (this.props.canClose) {
      tabContent.appendChild(ecma.dom.createElement('img', {
        'src': '[#`./images/close-tab.gif`]',
        'class': 'close-img',
        'onClick': [this.destroy, this]
      }));
    }
    ecma.dom.appendChildren(this.tabElem, ecma.dom.createElements(
      'div', {'id':'outer'}, [
        'div', {'class':'bt'}, [
          'div', {'class':'bl'}, [
            'div', {'class':'br'}, [
              'div', {'class':'btl'}, [
                'div', {'class':'btr'}, [
                  'div', {'class':'h2'}, [
                    tabContent
                  ],
                ],
              ],
            ],
          ],
        ],
      ]
    ));

    [#:if ./styles.css/orientation eq 'ltr']
    var al = 'al';
    var ar = 'ar';
    [#:else]
    var al = 'ar';
    var ar = 'al';
    [#:end if]
    var classNames = this.props.side == 'right' ? ar + ' w3 h3' : al + ' w2a h3';
    this.contentElem = ecma.dom.createElement('iframe', {
      'style': {'visibility': 'hidden'}, 'class': classNames,
      'onload': [this._onFrameLoad, this],
      'onunload': [this._onFrameUnload, this],
      'src': this.props.src
    });
    this.contentElem.frameBorder = '0';
    var list = this.tabset.elems.tabs[this.props.side];
    if (ecma.util.defined(this.props.pos)) {
      var tabAtPos = undefined;
      var idx = 0;
      for (var key in this.tabset.tabs) {
        var tab = this.tabset.tabs[key];
        if (tab.props.side == this.props.side) {
          if (idx == this.props.pos) tabAtPos = tab;
          idx++;
        }
      }
      if (tabAtPos) {
        list.insertBefore(this.tabElem, tabAtPos.tabElem);
      } else {
        list.appendChild(this.tabElem);
      }
    } else {
      list.appendChild(this.tabElem);
    }
    this.tabset.elems.workspace.appendChild(this.contentElem);
    if (!this.props.loadInBackground && !this.hasSelected) this.select();
  };

  var proto = this.Tab.prototype = {};

  proto.update = function (props) {
    if (props.name) {
      this.props.name = props.name;
      this.ui.name.innerHTML = this.props.name;
    }
    if (props.icon) {
      this.props.icon = props.icon;
    }
    if (props.src) {
      this.props.src = props.src;
      this.contentElem.src = this.props.src;
    }
  };

  proto.select = function () {
    this.hasSelected = true;
    for (var key in this.tabset.tabs) {
      var tab = this.tabset.tabs[key];
      if (tab.props.side != this.props.side) continue;
      if (tab === this) continue;
      tab.deselect();
    }
    ecma.dom.addClassNames(this.tabElem.firstChild, 'sel');
    ecma.dom.setStyle(this.contentElem, 'visibility', 'visible');
    this.tabset.history.push(this);
  };

  proto.deselect = function () {
    if (this.tabElem && this.tabElem.firstChild)
      ecma.dom.removeClassNames(this.tabElem.firstChild, 'sel');
    if (this.contentElem)
      ecma.dom.setStyle(this.contentElem, 'visibility', 'hidden');
  };

  proto.isSelected = function () {
    return ecma.dom.getStyle(this.contentElem, 'visibility') == 'hidden'
      ? false
      : true;
  };

  proto.rename = function (name, icon) {
    this.props.name = name;
    this.ui.name.innerHTML = name;
    if (icon && this.ui.icon) {
      ecma.dom.setAttribute(this.ui.icon, 'src', icon);
    }
  };

  proto.setId = function (id) {
    if (id == this.id) return;
    var xid = this.id;
    this.id = id;
    delete this.tabset.tabs[xid];
    this.tabset.tabs[id] = this;
  };

  proto.destroy = function (evt) {
    ecma.dom.stopEvent(evt);
    // Destroy the ui
    ecma.dom.removeElement(this.contentElem);
    ecma.dom.removeElement(this.tabElem);
    this.contentElem = null;
    this.tabElem = null;
    // Select the next or previous tab
    if (this.isSelected()) {
      for (var i = 0, tab; tab = this.tabset.history[i]; i++) {
        if (tab === this) {
          this.tabset.history.splice(i--, 1);
        }
      }
      var tab = this.tabset.history.pop();
      if (tab) tab.select();
    }
    // Remove ourselves
    delete this.tabset.tabs[this.id];
    this.tabset.updateUI();
  };

  proto.reload = function () {
    var doc = this.getDocument();
    doc.location.reload();
  };

  proto.setColor = function () {
  };

  proto.getDocument = function () {
    return ecma.dom.getContentDocument(this.contentElem);
  };

  proto.getWindow = function () {
    return ecma.dom.getContentWindow(this.contentElem);
  };

  proto._onFrameLoad = function (evt) {
    try {
      var win = this.getWindow();
//    ecma.console.log(win.location.href);
//    ecma.console.log('iframe:load');
      this.rename(this.props.name);
      this.tabset.updateUI();
    } catch (ex) {
      // The frame has (likely) loaded a page outside this domain
      this.destroy(evt);
    }
  };

  proto._onFrameUnload = function (evt) {
  };

});

/** @namespace res */
ECMAScript.Extend('res', function(ecma) {

  /**
   * @class Tabset - Horizontal left- and right-hand tabs using IFRAME for content
   * @param olTabsLeft <OL> Container for left-hand tabs
   * @param olTabsRight <OL> Container for right-hand tabs
   * @param divWorkspace <DIV> Container for tab content
   */

  var proto = {};

  this.Tabset = function (olTabsLeft, olTabsRight, divWorkspace) {
    this.layout = new ecma.res.tabset.TabLayout(this);
    this.tabs = {};
    this.elems = {
      tabs: {
        left: ecma.dom.getElement(olTabsLeft),
        right: ecma.dom.getElement(olTabsRight)
      },
      workspace: ecma.dom.getElement(divWorkspace)
    };
    this.navs = {
      left: new ecma.res.tabset.TabNav('lh-tab-nav', olTabsLeft),
      right: new ecma.res.tabset.TabNav('rh-tab-nav', olTabsRight)
    };
    this.history = [];
    this.layout.resize();
  };

  this.Tabset.prototype = proto;

  proto.getTab = function (id) {
    return this.tabs[id];
  };

  proto.getTabByWindow = function (win) {
    for (var id in this.tabs) {
      var tab = this.tabs[id];
      if (tab.getWindow() == win) {
        return tab;
      }
    }
    return null;
  };

  proto.createTab = function (props) {
    if (!props.id) throw 'Tab id required';
    var tab = this.getTab(props.id);
    if (!tab) {
      tab = this.tabs[props.id] = new ecma.res.tabset.Tab(this, props);
    } else {
      tab.select();
      if (props.src == tab.src) {
        tab.reload();
      } else {
        tab.update(props);
      }
    }
    return tab;
  };

  proto.updateUI = function () {
    this.navs.left.updateUI();
    this.navs.right.updateUI();
  };

  proto.rightHandOnly = function () {
    this.layout.rightHandOnly();
    this.layout.resize();
  };

});


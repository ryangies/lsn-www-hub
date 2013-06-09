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

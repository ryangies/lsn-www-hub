function Desktop() {
  var obj = new Object();
  /* api */
  obj.resize = Desktop_resize;
  obj.init = Desktop_init;
  obj.create = Desktop_create;
  obj.rename = Desktop_rename;
  obj.destroy = Desktop_destroy;
  obj.reload = Desktop_reload;
  obj.select = Desktop_select;
  obj.deselect = Desktop_deselect;
  obj.display = Desktop_display;
  obj.bootstrap = Desktop_bootstrap;
  obj.getDocument = Desktop_getDocument;
  obj.getWindow = Desktop_getWindow;
  obj.setTabColor = Desktop_setTabColor;
  /* members */
  obj.level = 0;
  obj.defaultTab = undefined;
  obj.selectedTab = undefined;
  obj.selectedLeft = undefined;
  obj.selectedRight = undefined;
  obj.rhLayout = false;
  obj.reloadOnClick = true;
  obj.tabs = new Object();
  obj.lhWidth = .70;
  obj.rhWidth = .30;
  return obj;
}

function Desktop_init(ds, params) {
  var r = new LSN.Request(ds, {
    params: params,
    onSuccess: function() {
      Desktop.bootstrap(this.responseHash.get('tabs'))
    }
  });
}

function Desktop_bootstrap(tabList) {
  if (parent.Desktop && parent.Desktop == this) {
    // This is the top-level desktop
    LSN.getElement('all-tabs').className = 'top';
  } else {
    this.level = parent.Desktop.level + 1;
  }
  var defSide = this.rhLayout ? 'right' : 'left';
  tabList.iterate(function (k, v) {
    this.create(k, v);
    if (!this.defaultTab) {
      var tab = this.tabs[k];
      if (!tab.side || (tab.side && tab.side == defSide)) {
        this.defaultTab = k;
      }
    }
  }, this);
  if (this.defaultTab) {
    var li = LSN.getElement('li_' + this.defaultTab);
    li.style.marginLeft = (10 * Desktop.level) + 'px';
    this.select(this.defaultTab);
  }
}

function Desktop_destroy(name) {
  if (!this.tabs[name]) return;
  var list = LSN.getElement(this.tabs[name].side == 'right' ? 'rh-tabs' : 'lh-tabs');
  LSN.getElement('workspace').removeChild(LSN.getElement('frame_' + name));
  LSN.getElement(list).removeChild(LSN.getElement('li_' + name));
  if (this.selectedLeft == name || this.selectedRight == name) {
    var leftTabName, rightTabName = null;
    var isLeft = true;
    for (n in this.tabs) {
      if (n == name) {
        isLeft = false;
        continue;
      }
      if (this.tabs[n].side == this.tabs[name].side) {
        if (isLeft) {
          leftTabName = n;
        } else {
          rightTabName = n;
          break;
        }
      }
    }
    delete this.tabs[name];
    if (this.selectedLeft == name) this.selectedLeft = undefined;
    if (this.selectedRight == name) this.selectedRight = undefined;
    if (leftTabName || rightTabName) {
      this.select(rightTabName || leftTabName);
    }
  } else {
    delete this.tabs[name];
  }
}

function Desktop_reload(name) {
  if (!this.tabs[name]) return;
  try {
    var frame = LSN.getElement('frame_' + name);
    var win = LSN.getContentWindow('frame_' + name);
    if (frame.hasLoaded) {
      if (frame.src != this.tabs[name].url) {
        frame.src = this.tabs[name].url;
      } else {
        win.location.reload();
      }
      win.focus();
    }
  } catch (err) {
    alert(err);
  }
}

function Desktop_rename(name, title) {
  if (!name) name = this.selectedTab.tabName;
  if (this.tabs[name]) {
    this.tabs[name].title = title;
    LSN.getElement('a_' + name).innerHTML = title;
  }
}

function Desktop_create(name, props) {
  if (this.tabs[name]) {
    if (this.tabs[name].url != props.url) {
      this.tabs[name] = props;
      LSN.getElement('a_' + name).innerHTML = props.title;
      LSN.getElement('frame_' + name).hasLoaded = false;
    }
    return;
  }
  this.tabs[name] = props;
  this.tabs[name].tabName = name;
  var elemTabs = LSN.getElement(props.side == 'right' ? 'rh-tabs' : 'lh-tabs');
  var tabButtons = '';
  if (props.type == 'custom') {
    tabButtons += '<a class="closer" href="javascript:Desktop.destroy(\'' + name + '\')">'
      + '<img alt="x" title="Close tab" border="0" src="/res/desktop/close-tab.png"/></a>';
  }
  elemTabs.appendChild(LSN.createElement('li', {
    'id': 'li_' + name,
    'innerHTML': '<a href="javascript:Desktop.select(\'' + name + '\')"'
      + ' id="a_' + name + '">' + props.title + '</a>' + tabButtons + '</li>'
  }));
  var iframe = LSN.createElement('iframe', {
    'id': 'frame_' + name,
    'hasLoaded': false,
    'frameBorder': '0',
    'className': props.side
  });
  Event.observe(iframe, 'load', this.setTabColor.bind(this, name));
  LSN.getElement('workspace').appendChild(iframe);
}

function Desktop_deselect(name) {
  if (name == this.selectedLeft) this.selectedLeft = undefined;
  if (name == this.selectedRight) this.selectedRight = undefined;
  this.selectedTab = undefined;
  this.display();
}

function Desktop_select(name) {
  this.selectedTab = this.tabs[name];
  var doReload = false;
  /* set frame source if first select */
  var frame = LSN.getElement('frame_' + name);
  if (!frame) throw("Frame not found: " + name);
  if (!frame.hasLoaded) {
    try {
      frame.src = this.selectedTab.url;
      frame.hasLoaded = true;
    } catch (err) {
      // received when nesting too many desktops...
    }
  } else {
    doReload |= (name == this.selectedLeft);
    doReload |= (name == this.selectedRight);
  }
  /* left or right */
  if (this.selectedTab.side == 'right') {
    this.selectedRight = name;
  } else {
    this.selectedLeft = name;
  }
  this.display();
  if (this.reloadOnClick && doReload) {
    if (confirm('Reload this tab?')) {
      this.reload(name);
    }
  }
}

function Desktop_setTabColor(name) {
  var bg = '';
  if (name == this.selectedLeft || name == this.selectedRight) {
    var doc = this.getDocument(name);
    if (doc && doc.body && doc.body.style) {
      var win = this.getWindow(name);
      if (win && win.LSN) {
        try {
          bg = win.LSN.getStyle(doc.body, 'background-color');
        } catch(ex) {
          var tab = this.tabs[name];
          LSN.traceln(tab.title, '/', ex);
        }
      }
    }
  }
  var li = LSN.getElement('li_' + name);
  LSN.setStyle(li, 'background-color', bg);
  LSN.setStyle(li, 'border-bottom-color', bg);
}

function Desktop_display() {
  /* sync display */
  for (var itr in this.tabs) {
    var frame = LSN.getElement('frame_' + itr);
    var anchor = LSN.getElement('a_' + itr);
    var li = LSN.getElement('li_' + itr);
    var tab = this.tabs[itr];
    var openSymbol = tab.side == 'right' ? '&#171;' : '&#187;';
    var closeSymbol = tab.side == 'right' ? '&#187;' : '&#171;';
    if (itr == this.selectedLeft || itr == this.selectedRight) {
      frame.style.display = 'block';
      setTimeout(this.setTabColor.bind(this, itr), 100);
//    this.setTabColor(itr);
      li.className = 'current';
      if (tab.type == 'toggle') {
        anchor.href = 'javascript:Desktop.deselect(\'' + itr + '\')';
        anchor.innerHTML = closeSymbol + '&nbsp;' + tab.title;
      }
      anchor.blur();
    } else {
      if (frame.style.display != 'none') this.setTabColor(itr);
      frame.style.display = 'none';
      li.className = '';
      if (tab.type == 'toggle') {
        anchor.href = 'javascript:Desktop.select(\'' + itr + '\')';
        anchor.innerHTML = openSymbol + '&nbsp;' + tab.title;
      }
      anchor.blur();
    }
  }
  this.resize();
}

function Desktop_resize() {
  var dims = LSN.getWindowSize();
  var workspace = LSN.getElement('workspace');
  var posTop = LSN.getTop(workspace);
  var height = dims[1] - posTop;
  var lhWidth = dims[0] * this.lhWidth;
  var rhWidth = dims[0] * this.rhWidth;
  if (!(this.selectedRight && this.selectedLeft)) {
    /* only one is selected */
    lhWidth = dims[0];
    rhWidth = dims[0];
  }
  if (this.selectedLeft) {
    var elem = LSN.getElement('frame_' + this.selectedLeft);
    elem.style.top = posTop;
    elem.style.height = height + 'px';
    elem.style.width = lhWidth + 'px';
  }
  if (this.selectedRight) {
    var elem = LSN.getElement('frame_' + this.selectedRight);
    elem.style.top = posTop;
    elem.style.left = (dims[0] - rhWidth) + 'px';
    elem.style.height = height + 'px';
    elem.style.width = rhWidth + 'px';
    LSN.getElement('lh-tabs').style.width = lhWidth + 'px';
  } else {
    LSN.getElement('lh-tabs').style.width = '';
  }
  if (this.rhLayout) {
    var rhTabs = LSN.getElement('rh-tabs');
    var lhTabsWidth = this.selectedLeft ? 0 : dims[0] * this.lhWidth;
    rhTabs.style.right = '';
    rhTabs.style.left = (dims[0] - rhWidth +lhTabsWidth) + 'px';
  }
}

function Desktop_getDocument(name) {
  if (!this.tabs[name]) return;
  return LSN.getContentDocument(LSN.getElement('frame_' + name).id);
}

function Desktop_getWindow(name) {
  if (!this.tabs[name]) return;
  return LSN.getContentWindow(LSN.getElement('frame_' + name).id);
}

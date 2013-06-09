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

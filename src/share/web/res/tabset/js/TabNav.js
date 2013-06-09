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

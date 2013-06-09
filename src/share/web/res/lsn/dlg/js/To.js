js.extend('lsn.ext.dlg', function (js) {

  this.To = function (ui) {

    // Context pointer this is bound to the js.lsn.Dialog object
    var dlg = this;
    dlg.ui = ui;

    // Insert a function which updates the to-address display
    dlg.updateUI = function () {
      try {
        var newAddr = this.getNewAddress();
        js.dom.setAttribute(this.ui.addr, 'innerHTML', newAddr);
        if (this.ui.btnOk) js.dom.removeAttribute(this.ui.btnOk, 'disabled');
        if (this.ui.name) js.dom.removeClassNames(this.ui.name, 'err');
      } catch (ex) {
        js.dom.setAttribute(this.ui.addr, 'innerHTML', ex);
        if (this.ui.btnOk) js.dom.setAttribute(this.ui.btnOk, 'disabled');
        if (this.ui.name) js.dom.addClassNames(this.ui.name, 'err');
      }
    };

    // Create the tree list
    dlg.tree = new js.lsn.ext.dlg.ToList(
      dlg.ui.tree,
      dlg.params.hub,
      dlg.params.ra || '/',
      dlg.params.node,
      js.lang.createCallback(dlg.updateUI, dlg)
    );

    dlg.getNewAddress = function () {
      var node = this.tree.getSelected();
      var parts = js.data.addr_split(node.addr);
      var name = js.dom.getValue(this.ui.name);
      if (name.length <= 0) throw 'Name not specified';
      if (node.type.match(/-array/)) {
        if (!name.match(/^\d+$/)) throw 'Name is not an array index';
        if (name < 0 || name > node.length) throw 'Index is outside of the array';
      }
      parts.push (name);
      var newAddr = '/' + js.data.addr_join(parts);
      if (newAddr == this.params.node.addr) throw 'Choose a new destination';
      if (this.params.hub.get(newAddr)) throw 'Destination exists';
      return newAddr;
    };

    // Initialize the name input control
    js.dom.setAttribute(this.ui.name, 'value', js.data.addr_name(dlg.params.node.addr));
    js.dom.addEventListener(this.ui.name, 'keyup', function (event) {
      this.updateUI();
    }, dlg);

    // Exand and select parent of from address
    var pa = js.data.addr_parent(dlg.params.node.addr);
    dlg.tree.expand(pa, true);

  };

  /** @class ToList */

  var baseClass = js.hub.List;
  var proto = js.lang.createMethods(baseClass);

  this.ToList = function (e, hub, ra, node, os) {
    this.node = node; // from-address
    var opts = js.util.overlay({}, node.type.match(/^data/)
      ? this.dataOpts : this.fsOpts);
    opts.onSelect = os;
    baseClass.call(this, e, hub, ra, opts);
  },

  this.ToList.prototype = proto;

  proto.dataOpts = {

    formatName: function (node, str) {
      return node.addr.indexOf(this.node.addr) == 0 ? '<s>'+str+'</s>' : str;
    },

    canDisplay: function (node) {
      return true;
    },

    onClick: function (event, node) {
      if (!node.type.match(/^(file-)?data/)) js.dom.stopEvent(event);
      if (!node.ccd) js.dom.stopEvent(event);
      if (node.addr.indexOf(this.node.addr) == 0) js.dom.stopEvent(event);
    }

  };

  proto.fsOpts = {

    formatName: function (node, str) {
      return node.addr.indexOf(this.node.addr) == 0 ? '<s>'+str+'</s>' : str;
    },

    canDisplay: function (node) {
      return node.type == 'directory';
      //return !node.type.match(/^data-/);
    },

    onClick: function (event, node) {
      if (node.addr.indexOf(this.node.addr) == 0) js.dom.stopEvent(event);
      if (node.type != 'directory') js.dom.stopEvent(event);
    }

  };

});

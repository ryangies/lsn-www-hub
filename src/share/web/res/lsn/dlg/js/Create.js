ECMAScript.Extend('lsn', function (ecma) {

  this.dlg.Create = function (ui) {

    var dlg = this;
    dlg.ui = ui;

    // Insert a function which updates the to-address display
    dlg.updateUI = function () {
      try {
        var newAddr = this.getNewAddress();
        ecma.dom.setAttribute(this.ui.addr, 'innerHTML', newAddr);
        if (this.ui.btnOk) ecma.dom.removeAttribute(this.ui.btnOk, 'disabled');
        if (this.ui.name) ecma.dom.removeClassNames(this.ui.name, 'err');
      } catch (ex) {
        ecma.dom.setAttribute(this.ui.addr, 'innerHTML', ex);
        if (this.ui.btnOk) ecma.dom.setAttribute(this.ui.btnOk, 'disabled', 'disabled');
        if (this.ui.name) ecma.dom.addClassNames(this.ui.name, 'err');
      }
    };

    dlg.getTargetNode = function () {
      return this.params.node;
    };

    dlg.getNewAddress = function () {
      var node = this.getTargetNode();
      var parts = ecma.data.addr_split(node.addr);
      var name = ecma.dom.getValue(this.ui.name);
      if (name.length <= 0) throw 'Enter a new name';
      if (node.type.match(/-array/)) {
        if (!name.match(/^\d+$/)) throw 'Name is not an array index';
        if (name < 0 || name > node.length) throw 'Index is outside of the array';
      }
      parts.push (name);
      var newAddr = '/' + ecma.data.addr_join(parts);
      if (newAddr == this.params.node.addr) throw 'Choose a new destination';
      if (this.params.hub.get(newAddr)) throw 'Destination exists';
      return newAddr;
    };

    // Initialize the name input control
    ecma.dom.setAttribute(this.ui.name, 'value', '');
    ecma.dom.addEventListener(this.ui.name, 'keyup', function (event) {
      this.updateUI();
    }, this);

    // Update the UI
    ecma.dom.setAttribute(ui.icon, 'src', ecma.hub.getIcon(ui.type));
    dlg.updateUI();

  };

});

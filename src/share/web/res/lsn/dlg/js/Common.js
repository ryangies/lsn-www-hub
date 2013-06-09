js.extend('lsn.ext.dlg', function (js) {

  this.createIconAddress = function (n) {
    return js.dom.createElements(
      'img', {'src':n.icon,'style':{'vertical-align':'text-top','margin-right':'4px'}},
      'span', {'innerHTML':n.addr}
    );
  };

});

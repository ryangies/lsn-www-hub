js.extend('lsn.ext.dlg', function (js) {

  this.Download = function (dlg, ui) {
    this.dlg = dlg;
    this.ui = ui;
    this.intervalId = undefined;
    this.downloading = false;
    js.dom.addEventListener(ui.uri, 'keyup', this.onSelect, this);
  };

  this.Download.prototype = {

    download: function () {
      this.dlg.stopEvent(); // prevent hiding
      js.dom.setStyle(this.ui.to, 'display', 'none');
      js.dom.setStyle(this.ui.uri, 'visibility', 'hidden');
      js.dom.setAttribute(this.ui.btnOk, 'disabled', 'disabled');
      js.dom.setAttribute(this.ui.btnCancel, 'innerHTML', 'Close');
      this._setStatus('[#dl-init.str]');
      this.downloading = true;
      js.dom.setTimeout(this.startMonitor, 1000, this);
      var uri = this.dlg.params.node.addr;
      uri += '?name=' + this.ui.name.value;
      uri += '&uri=' + this.ui.uri.value;
      new js.lsn.Request(uri, {
        headers: {'X-Command': 'download'},
        onSuccess: js.lang.createCallback(function (r) {
          this.dlg.params.hub.fetch(this.dlg.params.node.addr);
          this._setStatus('[#dl-complete.str]');
          js.dom.setTimeout(this.dlg.hide, 1000, this.dlg);
        }, this),
        onFailure: js.lang.createCallback(function (r) {
          this._setStatus(r.responseText);
        }, this),
        onComplete: js.lang.createCallback(function (r) {
          this.downloading = false;
          this.stopMonitor();
        }, this)
      }).submit();
    },

    stopMonitor: function () {
      if (!this.intervalId) return;
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    },

    startMonitor: function () {
      if (this.intervalId) this.stopMonitor();
      if (!this.downloading) return;
      this.intervalId = js.dom.setInterval(this.monitor, 1000, this);
    },

    monitor: function () {
      var uri = this.dlg.params.node.addr;
      uri += '?name=' + this.ui.name.value;
      new js.lsn.Request(uri, {
        headers: {'X-Command': 'status'},
        onSuccess: js.lang.createCallback(function (r) {
          if (!this.downloading) return;
          var sz = r.responseHash.get('body/size');
          var rec = r.responseHash.get('body/received');
          var sz2 = r.responseHash.get('body/size2');
          var rec2 = r.responseHash.get('body/received2');
          var percent = Math.round((rec/sz)*100);
          var msg = percent + '% (' + rec2 + ' / ' + sz2 + ')';
          if (rec >= sz) {
            this.stopMonitor();
            msg = '[#dl-complete.str]: ' + msg;
          } else {
            msg = '[#dl-downloading.str]: ' + msg;
          }
          this._setStatus(msg);
        }, this),
        onFailure: js.lang.createCallback(function (r) {
          this.stopMonitor();
        }, this)
      }).submit();
    },

    _setStatus: function (msg) {
      js.dom.setAttribute(this.ui.progress, 'innerHTML', msg);
    },

    onSelect: function () {
      if (this.ui.uri.value) {
        var uri = this.ui.uri.value;
        var idx = uri.indexOf('?');
        if (idx > 0) uri = uri.substr(0, idx);
        var fn = decodeURIComponent(uri);
        idx = fn.lastIndexOf('/');
        idx = js.util.defined(idx) ? idx + 1 : 0;
        fn = fn.substr(idx);
        js.dom.setStyle(this.ui.to, 'display', 'block');
        js.dom.getElement(this.ui.name).value = fn;
        this.dlg.updateUI();
      }
    }

  };

});

__DATA__

dl-init.str => Initializing download
dl-downloading.str => Downloading
dl-complete.str => Download complete

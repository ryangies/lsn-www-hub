ECMAScript.Extend('lsn', function (ecma) {

  this.dlg.Upload = function (dlg, ui) {
    this.dlg = dlg;
    this.ui = ui;
    this.intervalId = undefined;
    this.uploading = false;
    ecma.dom.addEventListener(ui.iframe, 'load', this.onLoad, this);
  },

  this.dlg.Upload.prototype = {

    onLoad: function () {
      this.uploading = false;
      try {
        var doc = ecma.dom.getContentDocument(this.ui.iframe);
        var form = doc.getElementById('form');
        if (form) {
          ecma.dom.setStyle(this.ui.iframe, 'visibility', 'visible');
          var file = doc.getElementById('file');
          ecma.dom.addEventListener(file, 'change', this.onSelect, this);
        } else {
          this.stopMonitor();
          var body = doc.getElementsByTagName('body')[0];
          var resp = body.textContent || body.innerText;
          if (resp && resp == 'COMPLETE') {
            this.dlg.params.hub.fetch(this.dlg.params.node.addr);
            this._setStatus('[#upl-complete.str]');
            ecma.dom.setTimeout(this.dlg.hide, 1000, this.dlg);
          } else {
            this._setStatus(resp);
          }
        }
      } catch (ex) {
        // TODO Why is the IE error document is not our document
        // Oh yeah, I remember it being about size, like you put in a bunch
        // of text to make it over 64K or something...
        this._setStatus("An error occured (file is probably too big)");
      }
      ecma.dom.removeAttribute(this.ui.btnCancel, 'disabled');
    },

    upload: function () {
      var doc = ecma.dom.getContentDocument(this.ui.iframe);
      var form = doc.getElementById('form');
      if (!form) return;
      this.dlg.stopEvent(); // prevent hiding
      try {
        var uri = this.dlg.params.node.addr;
        uri += '?X-Command=upload';
        uri += '&name=' + this.ui.name.value;
        ecma.dom.setAttribute(form, 'action', uri);
        ecma.dom.setStyle(this.ui.to, 'display', 'none');
        ecma.dom.setStyle(this.ui.iframe, 'visibility', 'hidden');
        ecma.dom.setAttribute(this.ui.btnOk, 'disabled', 'disabled');
        ecma.dom.setAttribute(this.ui.btnCancel, 'innerHTML', 'Close');
        ecma.dom.setAttribute(this.ui.btnCancel, 'disabled', 'disabled');
        this._setStatus('[#upl-init.str]');
        this.uploading = true;
        ecma.dom.setTimeout(this.startMonitor, 1000, this);
        form.submit();
      } catch (ex) {
        alert(ex);
      }
    },

    stopMonitor: function () {
      if (!this.intervalId) return;
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    },

    startMonitor: function () {
      if (this.intervalId) this.stopMonitor();
      if (!this.uploading) return;
      this.intervalId = ecma.dom.setInterval(this.monitor, 1000, this);
    },

    monitor: function () {
      var upl = this;
      var uri = this.dlg.params.node.addr;
      uri += '?name=' + this.ui.name.value;
      new ecma.lsn.Request(uri, {
        headers: {'X-Command': 'status'},
        onSuccess: function (r) {
          if (!upl.uploading) return;
          var sz = ecma.util.asInt(r.responseHash.get('body/size'));
          var rec = ecma.util.asInt(r.responseHash.get('body/received'));
          var sz2 = r.responseHash.get('body/size2');
          var rec2 = r.responseHash.get('body/received2');
          var percent = Math.round((rec/sz)*100);
          if (isNaN(percent)) return;
          var msg = percent + '% (' + rec2 + ' / ' + sz2 + ')';
          if (rec >= sz) {
            upl.stopMonitor();
            msg = '[#upl-complete.str]: ' + msg;
            ecma.dom.setAttribute(this.ui.btnCancel, 'disabled', '');
          } else {
            msg = '[#upl-uploading.str]: ' + msg;
          }
          upl._setStatus(msg);
        },
        onFailure: function (r) {
          upl.stopMonitor();
          ecma.dom.setAttribute(this.ui.btnCancel, 'disabled', '');
        }
      }).submit();
    },

    _setStatus: function (msg) {
      ecma.dom.setAttribute(this.ui.progress, 'innerHTML', msg);
    },

    onSelect: function () {
      var doc = ecma.dom.getContentDocument(this.ui.iframe);
      var file = doc.getElementById('file');
      if (file.value) {
        var fn = file.value.replace(/\\/g, '/');
        var idx = fn.lastIndexOf('/');
        idx = ecma.util.defined(idx) ? idx + 1 : 0;
        fn = fn.substr(idx);
        ecma.dom.setStyle(this.ui.to, 'display', 'block');
        ecma.dom.getElement(this.ui.name).value = fn;
        ecma.dom.getElement(this.ui.name).focus();
        this.dlg.updateUI();
      }
    }

  };

});

__DATA__

upl-init.str => Initializing upload
upl-uploading.str => Uploading
upl-complete.str => Upload complete

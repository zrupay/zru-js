;(function () {

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server. Use `self` instead of `window` for `WebWorker` support.
  var root = typeof self === 'object' && self.self === self && self ||
            typeof global === 'object' && global.global === global && global;

  var ZRU = function(publicKey, customOptions) {
    this.publicKey = publicKey;
    this.PAY_URL = 'https://pay.mychoice2pay.com/';
    this.token = null;
    this.tokenInfo = null;
    this.tokenCardGateway = null;
    this.gatewaysList = [];
    this.gatewaySelected = null;

    this.APM_OPEN_TYPE_REDIRECT = 'redirect';
    this.APM_OPEN_TYPE_HTML = 'html';
    this.APM_OPEN_TYPE_IFRAME = 'iframe';
    this.APM_OPEN_TYPE_WINDOW = 'window';

    this.options = {
      iframeId: (customOptions && customOptions.iframeId) || 'zru-iframe',
      htmlDivId: (customOptions && customOptions.htmlDivId)|| 'zru-html-div',
      apmOpenType: (customOptions && customOptions.apmOpenType) || 'redirect',
      apmSettings: (customOptions && customOptions.apmSettings) || {},
      windowsClosedCallback: (customOptions && customOptions.windowsClosedCallback) || undefined,
      windowsFinishedCallback: (customOptions && customOptions.windowsFinishedCallback) || undefined
    };

    this.__hideId(this.options.iframeId);
    this.__hideId(this.options.htmlDivId);
  };

  // Private

  ZRU.prototype.__request = function (method, url, data, callback) {
    var xmlHttp = new XMLHttpRequest();
    if (callback) {
      xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4) {
          callback(JSON.parse(xmlHttp.responseText));
        }
      }
    }

    xmlHttp.open(method, url, !!callback);
    xmlHttp.setRequestHeader("Authorization", "PublicKey " + this.publicKey);
    xmlHttp.setRequestHeader("Content-type", "application/json");
    xmlHttp.send(data ? JSON.stringify(data) : null);
    if (!callback) {
      return JSON.parse(xmlHttp.responseText);
    }
  };

  ZRU.prototype.__defineUrls = function (token) {
    this.API_URL = 'https://api.zrupay.com/v1/pay/' + this.token + '/';
    this.API_HTML_URL = this.API_URL + 'html/';
    this.API_CARD_URL = this.API_URL + 'card/';
    this.REDIRECT_URL = this.PAY_URL + this.token + '/redirect/';
  };

  ZRU.prototype.__checkIfToken = function () {
    if (!this.token) {
      throw new Error('Must call function setToken before');
    }
  };

  ZRU.prototype.__checkIfTokenCardGateway = function () {
    this.__checkIfToken();
    if (!this.tokenCardGateway) {
      throw new Error('Must have a card gateway configured');
    }
  };

  ZRU.prototype.__selectGateway = function (gatewayCode) {
    this.__checkIfToken();
    for (var i = 0; i < this.gatewaysList.length; i++) {
      if (this.gatewaysList[i].code === gatewayCode) {
        this.gatewaySelected = this.gatewaysList[i];
        return;
      }
    }
    this.gatewaySelected = null;
  };

  ZRU.prototype.__receiveMessages = function(callback, iframe) {
    this.__receiveMessagesCallback = callback;

    // Create IE + others compatible event handler
    var eventMethod = window.addEventListener ? 'addEventListener' : 'attachEvent';
    var eventer = window[eventMethod];
    var messageEvent = eventMethod == 'attachEvent' ? 'onmessage' : 'message';

    // Listen to message from child window
    eventer(messageEvent, event => {
      if (event.data == 'MC2P_DONE' || event.data == 'ZRU_DONE') {
        this.__hideId(iframe.id);
        this.__receiveMessagesCallback({success: true});
      } else if (event.data == 'MC2P_CANCEL' || event.data == 'MC2P_EXPIRED' || event.data == 'ZRU_CANCEL' || event.data == 'ZRU_EXPIRED') {
        this.__hideId(iframe.id);
        this.__receiveMessagesCallback({success: false, error: event.data});
      } else if (event.data.number) {
        this.__hideId(iframe.id);
        this.__receiveMessagesCallback({success: false, error: event.data.number[0], messages: event.data.messages});
      }
    }, false);
  };

  ZRU.prototype.__hideId = function (id) {
    var idElement = document.getElementById(id);
    if (idElement) {
      idElement.style.display = 'none';
    }
  };

  ZRU.prototype.__showIframe = function (iframe, url) {
    if (!iframe) {
      throw new Error('Must have an iframe');
    }
    iframe.setAttribute('src', url);
    iframe.style.display = 'block';
  };

  ZRU.prototype.__showHtml = function (htmlDiv, gatewayCode, submit) {
    if (!htmlDiv) {
      throw new Error('Must have an html div');
    }
    var htmlInfo = this.__request("GET", this.API_HTML_URL + gatewayCode + '/', null, null);
    htmlDiv.innerHTML = htmlInfo.html;
    htmlDiv.style.display = 'block';
    if (submit) {
      document.querySelector('#' + htmlDiv.id + ' form').submit();
    }
  };


  // Public

  ZRU.prototype.setToken = function (token) {
    this.token = token;
    this.__defineUrls(token);
    this.tokenInfo = this.__request("GET", this.API_URL, null, null);
    if (this.tokenInfo.detail) {
      this.token = null;
      throw new Error(this.tokenInfo.detail);
    }
    this.gatewaysList = this.tokenInfo.gateways;
    this.tokenCardGateway = null;
    for (var i = 0; i < this.tokenInfo.gateways.length; i++) {
      if (this.tokenInfo.gateways[i].form == 'card') {
        this.tokenCardGateway = this.tokenInfo.gateways[i];
        break;
      }
    }
  };

  ZRU.prototype.getGateways = function () {
    this.__checkIfToken();
    return this.gatewaysList;
  };
  
  ZRU.prototype.selectGateway = function (gatewayCode, htmlDivId, iframeId) {
    this.__selectGateway(gatewayCode);
    if (!this.gatewaySelected) {
      throw new Error('Gateway not found');
    }

    var htmlDiv = null;
    if (htmlDivId || this.options.htmlDivId) {
      var htmlDiv = document.getElementById(htmlDivId || this.options.htmlDivId);
      this.__hideId(htmlDivId || this.options.htmlDivId);
    }
    var iframe = null;
    if (iframeId || this.options.iframeId) {
      var iframe = document.getElementById(iframeId || this.options.iframeId);
      this.__hideId(iframeId || this.options.iFrameId);
    }

    var redirectUrl = this.REDIRECT_URL + this.gatewaySelected.code;
    switch (this.gatewaySelected.form) {
      case 'card':
        this.__showIframe(iframe, redirectUrl);
        break;
      case 'html':
        var openType = this.options.apmSettings[this.gatewaySelected.code] || this.options.apmOpenType;
        switch (openType) {
          case this.APM_OPEN_TYPE_REDIRECT:
            document.location = redirectUrl;
            break;
          case this.APM_OPEN_TYPE_HTML:
            this.__showHtml(htmlDiv, gatewayCode, true);
            break;
          case this.APM_OPEN_TYPE_IFRAME:
            this.__showIframe(iframe, redirectUrl);
            break;
          case this.APM_OPEN_TYPE_WINDOW:
            var width = 400;
            var height = 560;
            var left = (window.outerWidth - width) / 2;
            var top = (window.outerHeight - height) / 2;
            var wnd = window.open(
              redirectUrl, 
              gatewayCode, 
              'width=' + width + ',height=' + height + ',scrollbars=NO,top=' + top + ',left=' + left
            );
            var zru = this;
            var closedTimer = setInterval(function () { 
              if(wnd.closed) {
                clearInterval(closedTimer);
                if (zru.options.windowsClosedCallback) {
                  zru.options.windowsClosedCallback({
                    gateway: gatewayCode 
                  });
                }
              }
            }, 500);
            window.addEventListener('message', function (event) {
              if (event.data == 'MC2P_DONE' || event.data == 'MC2P_CANCEL' || event.data == 'MC2P_EXPIRED' || event.data == 'ZRU_DONE' || event.data == 'ZRU_CANCEL' || event.data == 'ZRU_EXPIRED') {
                if (event.origin == zru.PAY_URL) {
                  clearInterval(closedTimer);
                  wnd.close();
                  if (zru.options.windowsFinishedCallback) {
                    zru.options.windowsFinishedCallback({
                      done: event.data == 'MC2P_DONE' || event.data == 'ZRU_DONE',
                      cancel: event.data == 'MC2P_CANCEL' || event.data == 'ZRU_CANCEL',
                      expired: event.data == 'MC2P_EXPIRED' || event.data == 'ZRU_EXPIRED',
                      gateway: gatewayCode 
                    });
                  }
                }
              }
            });
        }
    }
  };

  // Apple Pay Private

  ZRU.prototype.__requestApplePayInfo = function () {
    this.__checkIfTokenCardGateway();
    return this.__request('POST', this.API_URL + 'apple-pay/' + this.tokenCardGateway.code + '/info/', null, null);
  };

  ZRU.prototype.__sendAppleData = function(data) {
    this.__checkIfTokenCardGateway();
    var zru = this;
    this.__request('POST', this.API_URL + 'apple-pay/' + this.tokenCardGateway.code + '/', data, function (response) {
      if (response.messages) {
        const result = {
          'status': root.ApplePaySession.STATUS_FAILURE
        };
        zru.__appleSession.completePayment(result);
        if (zru.__appleCompleteCallback) {
          zru.__appleCompleteCallback({success: false, error: response.number[0], messages: response.messages});
        }
      } else if (response.result == 'merchant-validated') {
        zru.__appleSession.completeMerchantValidation(response.session);           
      } else {
        const result = {
          'status': root.ApplePaySession.STATUS_SUCCESS
        };
        zru.__appleSession.completePayment(result);
        if (zru.__appleCompleteCallback) {
          zru.__appleCompleteCallback({success: true});
        }
      }
    });
  };

  // Apple Pay Public

  ZRU.prototype.canUseApplePay = function () {
    if (this.tokenCardGateway && !this.tokenCardGateway.allow_apple_pay) {
      return false;
    }
    try {
      return root.ApplePaySession && root.ApplePaySession.canMakePayments();
    } catch (e) {
      return false;
    }    
  };

  ZRU.prototype.startApplePay = function () {
    return new Promise((resolve) => {
      this.__appleCompleteCallback = resolve;
      var appleInfo = this.__requestApplePayInfo();

      this.__appleSession = new root.ApplePaySession(1, appleInfo.session);

      this.__appleSession.onvalidatemerchant = (event) => {
        this.__sendAppleData({
          url: event.validationURL,
          domain: document.location.hostname
        });
      };

      this.__appleSession.onpaymentmethodselected = (event) => {
        const paymentMethodSelection = appleInfo.order;
        this.__appleSession.completePaymentMethodSelection(paymentMethodSelection.newTotal, paymentMethodSelection.newLineItems);
      };
      
      this.__appleSession.onpaymentauthorized = (event) => {
        this.__sendAppleData(event.payment.token);      
      };

      this.__appleSession.oncancel = (event) => {
        resolve({success: false});
      };

      this.__appleSession.begin();
    });
  };

  // Google Pay Private

  ZRU.prototype.__requestGooglePayInfo = function () {
    this.__checkIfTokenCardGateway();
    return this.__request('POST', this.API_URL + 'google-pay/' + this.tokenCardGateway.code + '/info/', null, null);
  };

  ZRU.prototype.__sendGoogleData = function(data, iframeId) {
    this.__checkIfTokenCardGateway();
    var zru = this;
    var iframe = null;
    if (iframeId || this.options.iframeId) {
      var iframe = document.getElementById(iframeId || this.options.iframeId);
      this.__hideId(iframeId || this.options.iFrameId);
    }
    this.__request('POST', this.API_URL + 'google-pay/' + this.tokenCardGateway.code + '/', data, function (response) {
      if (!zru.__googleCompleteCallback) {
        return;
      }
      if (response.messages) {
        zru.__googleCompleteCallback({success: false, error: response.number[0], messages: response.messages});
      } else if (response.result == 'verification-value-needed') {
        zru.__showIframe(iframe, zru.PAY_URL + zru.token + '/cvc/' + zru.tokenCardGateway.code + '?r=' + response.response_id + '&n=' + response.number_masked + '&w=' + response.wallet_slug);
        var completedPromise = new Promise((resolve) => {
          zru.__receiveMessages(resolve);
        })
        zru.__googleCompleteCallback({success: false, completed: completedPromise});
      } else {
        zru.__googleCompleteCallback({success: true});
      }
    });
  };

  // Google Pay Public

  ZRU.prototype.canUseGooglePay = function () {
    if (this.tokenCardGateway && !this.tokenCardGateway.allow_google_pay) {
      return false;
    }
    var _a, _b;
    return 'google' in root && !!((_b = (_a = google === null || google === void 0 ? void 0 : google.payments) === null || _a === void 0 ? void 0 : _a.api) === null || _b === void 0 ? void 0 : _b.PaymentsClient);
  };

  ZRU.prototype.startGooglePay = function (iframeId) {
    return new Promise((resolve) => {
      this.__googleCompleteCallback = resolve;
      var googleInfo = this.__requestGooglePayInfo();
      var zru = this;
      var googleSession = new google.payments.api.PaymentsClient({environment: this.tokenInfo.google_pay.environment});
      googleSession.isReadyToPay({
        allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
      }).then(function(response) {
        if (response.result) {
          googleSession.loadPaymentData(googleInfo).then(function(paymentData) {
            zru.__sendGoogleData(JSON.parse(paymentData.paymentMethodData.tokenizationData.token), iframeId);
          }).catch(function(err) {
            resolve({success: false});
          });
        } else {
          resolve({success: false});
        }
      });
    });
  };

  // Make module accessible:
  // export object for Node.js
  // or if we're in the browser, add `ZRU` as a global object.
  // (`nodeType` is checked to ensure that `module` and `exports` are not HTML elements.)
  if (typeof exports !== 'undefined' && !exports.nodeType) {
    if (typeof module !== 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = ZRU;
    }

    exports.ZRU = ZRU;
  } else {
    root.ZRU = ZRU;
  }
})();

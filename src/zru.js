;(function () {

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server. Use `self` instead of `window` for `WebWorker` support.
  var root = typeof self === 'object' && self.self === self && self ||
            typeof global === 'object' && global.global === global && global;

  var ZRU = function(publicKey, customOptions) {
    this.publicKey = publicKey;
    this.PAY_URL = (customOptions && customOptions.payUrl) || 'https://checkout.zrupay.com/';
    // event.origin never has a trailing slash
    this.PAY_ORIGIN = this.PAY_URL.replace(/\/$/, '');
    this.BASE_API_URL = (customOptions && customOptions.apiUrl) || 'https://api.zrupay.com/v1/';
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
      // windowsCompletedCallback kept as alias: it's the name documented in the README
      windowsFinishedCallback: (customOptions && (customOptions.windowsFinishedCallback || customOptions.windowsCompletedCallback)) || undefined
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
    this.API_URL = this.BASE_API_URL + 'pay/' + this.token + '/';
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
    var htmlInfo = this.__request("GET", this.API_HTML_URL + gatewayCode + '/', null, null);
    this.__renderHtml(htmlDiv, htmlInfo.html, submit);
  };

  // Shows the gateway html in the div and, when asked, submits its form (the page leaves to the gateway)
  ZRU.prototype.__renderHtml = function (htmlDiv, html, submit) {
    if (!htmlDiv) {
      throw new Error('Must have an html div');
    }
    htmlDiv.innerHTML = html;
    htmlDiv.style.display = 'block';
    var form = htmlDiv.querySelector('form');
    if (submit && form) {
      form.submit();
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
                if (event.origin == zru.PAY_ORIGIN) {
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

  // Card Fields Public

  // Installments the user can choose for the current token, e.g. [3, 6, 12]
  ZRU.prototype.getInstallments = function () {
    this.__checkIfToken();
    return (this.tokenInfo.transaction && this.tokenInfo.transaction.installments) || [];
  };

  // User data fields the payment screen requires for a card gateway; pass them in submit({data})
  ZRU.prototype.getRequiredUserData = function (gatewayCode) {
    this.__checkIfToken();
    var paymentScreen = this.tokenInfo.payment_screen || {};
    var code = gatewayCode || (this.tokenCardGateway && this.tokenCardGateway.code);
    var fields = [];
    if (paymentScreen.request_identification) {
      fields.push('identification');
    }
    if (code === 'PEI' && paymentScreen.request_pepper_client) {
      fields.push('first_name', 'last_name', 'email');
    }
    if (code === 'PEI' && paymentScreen.request_pepper_address) {
      fields.push('billing_street_name', 'billing_city', 'billing_province', 'billing_postal_code', 'billing_country_code');
    }
    return fields;
  };

  /**
   * Mounts each card field in its own iframe served by the checkout.
   * Card data never reaches this page: the field iframes send it to each other directly.
   *
   * The iframes only render a transparent input: the box, label and errors belong to the merchant page.
   *
   * var fields = zru.createCardFields({
   *   fields: { number: '#zru-number', expiry: '#zru-expiry', cvc: '#zru-cvc', name: '#zru-name' }
   * });
   * fields.on('change', function (e) {});  // e.field, e.valid, e.empty, e.error
   * fields.on('focus' | 'blur', function (e) {});  // e.field
   * fields.submit().then(function (result) {});  // result.success, result.threeDS (redirecting to the bank), result.dcc, result.error, result.messages
   * fields.submit({installment: 3, data: {identification: '12345678Z'}});  // optional, see getInstallments / getRequiredUserData
   * fields.confirmDcc('USD').then(function (result) {});  // after result.dcc: same result shape
   */
  ZRU.prototype.createCardFields = function (options) {
    this.__checkIfToken();

    var FIELD_NAMES = ['number', 'expiry', 'cvc', 'name'];
    var REQUIRED_FIELDS = ['number', 'expiry', 'cvc'];
    var zru = this;
    options = options || {};
    var fieldsOptions = options.fields || {};
    var iframes = {};
    var readyFields = {};
    var eventListeners = {};
    var pendingResolve = null;
    // The field iframes find the number one by name (zru-field-<instance>-<field>),
    // so several createCardFields() on the same page never talk to each other
    var instanceId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    // Each submit gets its own id so the number iframe ignores answers to an older one
    var submitCount = 0;
    // 'done', 'expired', 'cancelled' or 'not_found' once a field reports the transaction can't be paid
    var unavailableStatus = null;

    REQUIRED_FIELDS.forEach(function (field) {
      if (!fieldsOptions[field]) {
        throw new Error('createCardFields: field "' + field + '" is required');
      }
    });

    FIELD_NAMES.forEach(function (field) {
      var selector = fieldsOptions[field];
      if (!selector) {
        return;
      }
      var container = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (!container) {
        throw new Error('createCardFields: container not found for field "' + field + '"');
      }

      var iframe = document.createElement('iframe');
      iframe.src = zru.PAY_URL + zru.token + '/field/' + field;
      iframe.title = field;
      iframe.name = 'zru-field-' + instanceId + '-' + field;
      // The iframe learns this page's origin from the referrer in Firefox: send it even
      // when the page's Referrer-Policy is no-referrer
      iframe.referrerPolicy = 'origin';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'no');

      container.appendChild(iframe);
      iframes[field] = iframe;
    });

    // The merchant's html div (htmlDivId option) or a hidden one, only to host the 3DS form
    function getHtmlDiv() {
      var htmlDiv = document.getElementById(zru.options.htmlDivId);
      if (!htmlDiv) {
        htmlDiv = document.createElement('div');
        htmlDiv.id = zru.options.htmlDivId;
        htmlDiv.style.display = 'none';
        document.body.appendChild(htmlDiv);
      }
      return htmlDiv;
    }

    function isFromOwnIframe(source) {
      for (var field in iframes) {
        if (iframes[field].contentWindow === source) {
          return true;
        }
      }
      return false;
    }

    function emit(event, payload) {
      (eventListeners[event] || []).forEach(function (handler) {
        handler(payload);
      });
    }

    function resolvePending(result) {
      if (pendingResolve) {
        var resolve = pendingResolve;
        pendingResolve = null;
        resolve(result);
      }
    }

    function postToField(field, message) {
      if (iframes[field]) {
        iframes[field].contentWindow.postMessage(message, zru.PAY_ORIGIN);
      }
    }

    function postToAll(message) {
      for (var field in iframes) {
        postToField(field, message);
      }
    }

    function onMessage(event) {
      if (event.origin !== zru.PAY_ORIGIN || !isFromOwnIframe(event.source)) {
        return;
      }
      var data = event.data;
      if (!data || typeof data !== 'object') {
        return;
      }

      switch (data.type) {
        case 'ZRU_FIELD_READY':
          readyFields[data.field] = true;
          if (cardFields.isReady()) {
            emit('ready', {});
          }
          break;
        case 'ZRU_FIELD_VALID':
          emit('change', {field: data.field, valid: true, empty: !!data.empty, error: null});
          break;
        case 'ZRU_FIELD_ERROR':
          emit('change', {field: data.field, valid: false, empty: !!data.empty, error: data.error});
          break;
        case 'ZRU_FIELD_FOCUS':
          emit('focus', {field: data.field});
          break;
        case 'ZRU_FIELD_BLUR':
          emit('blur', {field: data.field});
          break;
        case 'ZRU_PAYMENT_OK':
          resolvePending({success: true});
          break;
        case 'ZRU_3DS_REQUIRED':
          // Same as the 'html' apmOpenType: the page goes to the bank and comes back through ZRU
          resolvePending({success: false, threeDS: true});
          zru.__renderHtml(getHtmlDiv(), data.html, true);
          break;
        case 'ZRU_TRANSACTION_UNAVAILABLE':
          // Every field reports it; tell the merchant once
          if (!unavailableStatus) {
            unavailableStatus = data.status;
            emit('unavailable', {status: data.status});
          }
          break;
        case 'ZRU_DCC_REQUIRED':
          resolvePending({success: false, dcc: data.dcc});
          break;
        case 'ZRU_PAYMENT_ERROR':
          resolvePending({success: false, error: data.error_code, messages: data.messages});
          break;
      }
    }

    window.addEventListener('message', onMessage);

    // One request at a time: submit() or confirmDcc(). Returns a Promise; callback is optional
    function startRequest(callback, send, immediateResult) {
      return new Promise(function (resolve) {
        var done = function (result) {
          if (callback) {
            callback(result);
          }
          resolve(result);
        };

        if (pendingResolve) {
          done({success: false, error: 'SUBMIT_IN_PROGRESS'});
          return;
        }
        if (immediateResult) {
          done(immediateResult);
          return;
        }
        pendingResolve = done;
        send();
      });
    }

    var cardFields = {
      /**
       * Pays with the card entered in the fields.
       * submit(gatewayCode, paymentScreenAccountId, callback) or
       * submit({gatewayCode, paymentScreenAccountId, installment, data}, callback).
       * gatewayCode defaults to the token's card gateway. Returns a Promise; callback is optional.
       */
      submit: function (gatewayCode, paymentScreenAccountId, callback) {
        var submitOptions = {};
        if (gatewayCode && typeof gatewayCode === 'object') {
          submitOptions = gatewayCode;
          callback = paymentScreenAccountId;
          gatewayCode = submitOptions.gatewayCode;
          paymentScreenAccountId = submitOptions.paymentScreenAccountId;
        }

        var code = gatewayCode || (zru.tokenCardGateway && zru.tokenCardGateway.code);
        if (unavailableStatus) {
          return startRequest(callback, null, {success: false, error: 'TRANSACTION_UNAVAILABLE', messages: {status: unavailableStatus}});
        }
        if (!code) {
          return startRequest(callback, null, {success: false, error: 'GATEWAY_NOT_FOUND'});
        }
        // A field that never reported ready would never answer, leaving the promise pending
        if (!cardFields.isReady()) {
          return startRequest(callback, null, {success: false, error: 'NOT_READY'});
        }
        return startRequest(callback, function () {
          submitCount += 1;
          postToAll({
            type: 'ZRU_SUBMIT',
            submit_id: instanceId + '-' + submitCount,
            gateway_code: code,
            payment_screen_account_id: paymentScreenAccountId || undefined,
            fields: Object.keys(iframes),
            installment: submitOptions.installment,
            data: submitOptions.data
          });
        });
      },

      /**
       * Confirms the currency after submit() returned result.dcc.
       * currency is one of result.dcc.offered[].currency, or result.dcc.original.currency to pay without conversion.
       */
      confirmDcc: function (currency, callback) {
        return startRequest(callback, function () {
          postToField('number', {type: 'ZRU_DCC_CONFIRM', currency: currency});
        });
      },

      // Events: 'change' ({field, valid, empty, error}), 'focus' / 'blur' ({field}), 'ready' (all fields loaded)
      // and 'unavailable' ({status}: the transaction is already paid, expired, cancelled or not found)
      on: function (event, handler) {
        if (!eventListeners[event]) {
          eventListeners[event] = [];
        }
        eventListeners[event].push(handler);
        return this;
      },

      focus: function (field) {
        postToField(field, {type: 'ZRU_FOCUS'});
      },

      clear: function (field) {
        postToField(field, {type: 'ZRU_CLEAR'});
      },

      isReady: function () {
        return Object.keys(iframes).every(function (field) {
          return readyFields[field];
        });
      },

      destroy: function () {
        window.removeEventListener('message', onMessage);
        for (var field in iframes) {
          var iframe = iframes[field];
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }
        iframes = {};
        readyFields = {};
        eventListeners = {};
        resolvePending({success: false, error: 'DESTROYED'});
      }
    };

    return cardFields;
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

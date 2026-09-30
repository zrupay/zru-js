# ZRU JS


## Overview

The ZRU JS SDK provides seamless integration with the ZRU API, enabling developers to easily manage the payment options in their applications.

## Installation

You can install using npm:

```bash
npm install zru-js
```

or to install from source, download [zru.min.js](https://raw.github.com/zrupay/zru-js/master/dist/zru.min.js) and include it in your HTML document, this will add a global object called ZRU:

```HTML
<script src="zru.min.js"></script>
```

## Quick Start Example

### Initialize the SDK

```javascript
var zru = new ZRU(
  'PUBLIC KEY', // Public key
  { // Optional
    iframeId: 'zru-iframe', // Default is 'zru-iframe'. ID of the iframe where the payment page will load, required if you choose the iframe option for apmOpenType or have a card payment option
    htmlDivId: 'zru-html-div', // Default is 'zru-html-div'. ID of the div where the payment form will load if you choose the html option for apmOpenType

    // apmOpenType: Specifies how the payment page will open. 
    // Possible values:
    // 'redirect': Redirects the user to the payment page of the gateway.
    // 'html': Include the payment form directly on this page and submit it to redirects the user to the payment page of the gateway without pass for our payment page.
    // 'iframe': Loads the payment page inside the iframe (some payment gateways may not support this), keeping the user on this page.
    // 'window': Opens a window with the payment page, keeping the user on this page.
    apmOpenType: 'redirect', // Default is 'redirect'. Change it depending on how you want the user to interact with the payment page.

    // apmSettings: Allows you to configure different settings for each payment gateway.
    // This object can include settings such as apmOpenType for specific gateways. 
    // Example: { 'PPI': 'html' } to use the 'html' option for the PayPal gateway.
    apmSettings: {},

    // windowsClosedCallback: A callback function that triggers when the payment window is closed if using 'window' as apmOpenType.
    // This can be useful for handling cases where the user closes the window without completing the payment.
    windowsClosedCallback: undefined,
    
    // windowsFinishedCallback: A callback that is triggered when the payment finishes using the 'window' option.
    // Receives { done, cancel, expired, gateway }. Useful to perform actions such as redirecting the user or displaying a confirmation message.
    // windowsCompletedCallback is also accepted as an alias.
    windowsFinishedCallback: undefined,
  }
);
```

### Set the token to use

```javascript
// Set the transaction, subscription, or authorization token to be used in this payment session.
zru.setToken('TOKEN');
```

### Get the gateway to show

```javascript
// Get the available gateways for the current token
var gateways = zru.getGateways();
// Example creating one button for each gateway
gateways.forEach(function (gateway) {
    // Create a button dynamically for each gateway returned by the getGateways function
    var button = document.createElement('button');
    button.innerHTML = "<img width=35px height=35px src=" + gateway.image + ">" + gateway.name;
    document.getElementById('gateways').appendChild(button);

    // When the button is clicked, select the corresponding gateway for the payment
    button.onclick = function () {
        zru.selectGateway(gateway.code);
    };
});
```

### Card fields in separate iframes

Mount each card field in your own layout. Every field is an iframe served by ZRU, so card data never touches your page.

Each iframe only contains a transparent input, using the text color and font configured in the ZRU panel. The box around it is yours: style each container (border, background, height, padding) and build labels and error messages on your page using the field events. The iframe fills its container.

```HTML
<div id="zru-number"></div>
<div id="zru-expiry"></div>
<div id="zru-cvc"></div>
<div id="zru-name"></div> <!-- Optional -->
<button id="pay-btn">Pay</button>
```

```javascript
// Number, expiry and cvc are required; name is optional.
// Each value can be a CSS selector or an HTMLElement.
var fields = zru.createCardFields({
  fields: {
    number: '#zru-number',
    expiry: '#zru-expiry',
    cvc: '#zru-cvc',
    name: '#zru-name',
  }
});

// Real-time validation: { field, valid, empty, error }
fields.on('change', function (event) {
  document.getElementById('zru-' + event.field).classList.toggle('is-invalid', !event.valid);
});

// Focus state for your borders: { field }
fields.on('focus', function (event) {});
fields.on('blur', function (event) {});

// All fields loaded
fields.on('ready', function () {});

document.getElementById('pay-btn').addEventListener('click', function () {
  // Uses the token's card gateway by default. You can also pass (gatewayCode, paymentScreenAccountId, callback).
  fields.submit().then(function (result) {
    if (result.success) {
      // Payment done
    } else if (result.html) {
      // 3DS required: inject result.html in your page
    } else {
      // result.error (e.g. INVALID_FIELDS, FIELDS_INCOMPLETE, SUBMIT_IN_PROGRESS) and result.messages
    }
  });
});

fields.focus('number');
fields.clear('cvc');
fields.destroy(); // Removes the iframes and listeners
```

#### Error codes

When `result.success` is `false` and there is no `result.html`, `result.error` contains one of these codes:

| Code | When |
|---|---|
| `INVALID_FIELDS` | One or more fields are invalid. Each one also fires a `change` event with its error |
| `FIELDS_INCOMPLETE` | A required field (number, expiry or cvc) didn't respond in time |
| `SUBMIT_IN_PROGRESS` | `submit()` was called while a previous payment is still in progress |
| `TRANSACTION_NOT_LOADED` | The transaction couldn't be loaded, e.g. an invalid or expired token |
| `GATEWAY_NOT_FOUND` | The token has no card gateway, or the `gatewayCode` passed doesn't exist |
| `DESTROYED` | `destroy()` was called while a payment was pending |
| `UNKNOWN_ERROR` | The payment failed without a specific code |

Any other value is the error code returned by the ZRU API when the payment is rejected, with the details in `result.messages`.

### More information

You can see examples of Google Pay and Apple Pay in the test.html file inside the test folder.
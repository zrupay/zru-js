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
    
    // windowsCompletedCallback: A callback that is triggered when the payment is successfully completed using the 'window' option.
    // Useful to perform actions such as redirecting the user or displaying a confirmation message.
    windowsCompletedCallback: undefined,
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

### More information

You can see examples of Google Pay and Apple Pay in the test.html file inside the test folder.
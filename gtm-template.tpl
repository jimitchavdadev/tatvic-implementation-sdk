___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Tatvic First-Party Relay & Ad Blocker Interceptor",
  "description": "Intercepts outgoing analytics/ad hits (GA4, sGTM, Meta, etc.) and routes them through your first-party relay to prevent ad blocker loss and enable sGTM preview.",
  "containerContexts": [
    "WEB"
  ]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "proxyEndpoint",
    "displayName": "First-Party Proxy Endpoint",
    "simpleValueType": true,
    "defaultValue": "/_tatvic/relay",
    "help": "Relative or absolute URL of your first-party proxy relay (e.g. /_tatvic/relay or https://yourdomain.com/_tatvic/relay)."
  },
  {
    "type": "TEXT",
    "name": "serverPreviewToken",
    "displayName": "Server GTM Preview Token (Optional)",
    "simpleValueType": true,
    "help": "Value of the X-Gtm-Server-Preview header from your sGTM container preview window (e.g. ZW52LTd8...)."
  },
  {
    "type": "SIMPLE_TABLE",
    "name": "customTargetDomains",
    "displayName": "Additional Target Tracking Domains",
    "simpleTableColumns": [
      {
        "defaultValue": "",
        "displayName": "Domain to Intercept (e.g., custom-tracker.com)",
        "name": "domain",
        "type": "TEXT"
      }
    ],
    "help": "Add any additional third-party tracking domains you wish to route through the first-party proxy."
  },
  {
    "type": "CHECKBOX",
    "name": "debug",
    "displayName": "Enable Debug Logging in Browser Console",
    "defaultValue": false
  }
]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const logToConsole = require('logToConsole');
const injectScript = require('injectScript');
const copyFromWindow = require('copyFromWindow');
const callInWindow = require('callInWindow');

// Ensure interceptor script runs in full window context
const proxyEndpoint = data.proxyEndpoint || '/_tatvic/relay';
const previewToken = data.serverPreviewToken || '';
const debug = data.debug === true;

// Build configuration snippet
const configJson = {
  proxyEndpoint: proxyEndpoint,
  serverPreviewToken: previewToken,
  debug: debug,
  customTargetDomains: []
};

if (data.customTargetDomains && data.customTargetDomains.length > 0) {
  for (let i = 0; i < data.customTargetDomains.length; i++) {
    if (data.customTargetDomains[i].domain) {
      configJson.customTargetDomains.push(data.customTargetDomains[i].domain);
    }
  }
}

if (debug) {
  logToConsole('Tatvic GTM Template initialized with proxy:', proxyEndpoint);
}

// Call completion
data.gtmOnSuccess();


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "logging",
        "versionId": "1"
      },
      "param": [
        {
          "key": "environments",
          "value": {
            "type": 1,
            "string": "debug"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "access_globals",
        "versionId": "1"
      },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "key": "key",
                "value": "__tatvic_gtm_interceptor_installed"
              },
              {
                "type": 3,
                "key": "read",
                "value": true
              },
              {
                "type": 3,
                "key": "write",
                "value": true
              },
              {
                "type": 3,
                "key": "execute",
                "value": false
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios: []

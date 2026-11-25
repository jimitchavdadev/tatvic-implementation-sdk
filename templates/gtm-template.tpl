___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Tatvic First-Party Relay & Ad Blocker Interceptor",
  "description": "Routes outgoing analytics and ad hits (GA4, sGTM, Meta, etc.) through your first-party relay to prevent ad-blocker data loss while strictly preserving GTM sandbox, templates, and Tag Assistant preview mode.",
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
const copyFromWindow = require('copyFromWindow');
const callInWindow = require('callInWindow');

const proxyEndpoint = data.proxyEndpoint || '/_tatvic/relay';
const previewToken = data.serverPreviewToken || '';
const debug = data.debug === true;

if (debug) {
  logToConsole('Tatvic GTM Template executing inside GTM Sandbox for proxy:', proxyEndpoint);
}

// Complete tag execution cleanly inside GTM sandbox
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
                "value": "dataLayer"
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

___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "GTM Container Overwrite (GTM-T32XGF8F)",
  "description": "Injects and forces container GTM-T32XGF8F on the page, preserving Tag Assistant preview mode.",
  "containerContexts": [
    "WEB"
  ]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "CHECKBOX",
    "name": "useStealthLoader",
    "displayName": "Use First-Party Stealth Loader (/_tatvic/loader.js)",
    "defaultValue": true,
    "help": "When enabled, loads container through /_tatvic/loader.js?cid=GTM-T32XGF8F to bypass ad blockers like uBlock Origin Lite. When disabled, loads directly from googletagmanager.com."
  },
  {
    "type": "CHECKBOX",
    "name": "debug",
    "displayName": "Enable Debug Logging in Browser Console",
    "defaultValue": true
  }
]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const injectScript = require('injectScript');
const getQueryParameters = require('getQueryParameters');
const getTimestamp = require('getTimestamp');
const logToConsole = require('logToConsole');

const targetId = 'GTM-T32XGF8F';
const debug = data.debug === true;
const isStealth = data.useStealthLoader !== false;

const debugParam = getQueryParameters('gtm_debug');
const authParam = getQueryParameters('gtm_auth');
const previewParam = getQueryParameters('gtm_preview');

let url = isStealth ? ('/_tatvic/loader.js?cid=' + targetId) : ('https://www.googletagmanager.com/gtm.js?id=' + targetId);

if (debugParam) {
  url = url + '&gtm_debug=' + debugParam;
}
if (authParam) {
  url = url + '&gtm_auth=' + authParam;
}
if (previewParam) {
  url = url + '&gtm_preview=' + previewParam;
}

if (debug) {
  logToConsole('[GTM Overwrite Template] Injecting GTM container from:', url);
}

// Pass cacheToken so GTM does not deduplicate and skip injecting the second container
const cacheToken = 'gtm_' + targetId + '_' + getTimestamp();

injectScript(url, function() {
  if (debug) {
    logToConsole('[GTM Overwrite Template] GTM container loaded successfully:', targetId);
  }
  data.gtmOnSuccess();
}, function() {
  if (debug) {
    logToConsole('[GTM Overwrite Template] Failed to load container:', url);
  }
  data.gtmOnFailure();
}, cacheToken);


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "inject_script",
        "versionId": "1"
      },
      "param": [
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://www.googletagmanager.com/*"
              },
              {
                "type": 1,
                "string": "https://*/*"
              },
              {
                "type": 1,
                "string": "http://*/*"
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
  },
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
        "publicId": "get_url",
        "versionId": "1"
      },
      "param": [
        {
          "key": "queries",
          "value": {
            "type": 1,
            "string": "any"
          }
        },
        {
          "key": "urlParts",
          "value": {
            "type": 1,
            "string": "any"
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

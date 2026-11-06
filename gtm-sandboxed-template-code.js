const injectScript = require('injectScript');
const getQueryParameters = require('getQueryParameters');
const getTimestamp = require('getTimestamp');
const logToConsole = require('logToConsole');

const targetId = 'GTM-T32XGF8F';
const debugParam = getQueryParameters('gtm_debug');
const authParam = getQueryParameters('gtm_auth');
const previewParam = getQueryParameters('gtm_preview');

let url = 'https://www.googletagmanager.com/gtm.js?id=' + targetId;

if (debugParam) {
  url = url + '&gtm_debug=' + debugParam;
}
if (authParam) {
  url = url + '&gtm_auth=' + authParam;
}
if (previewParam) {
  url = url + '&gtm_preview=' + previewParam;
}

// CRITICAL: Unique cache token forces GTM injectScript to load the second container!
// Without this token, GTM sees gtm.js is already on the page and silently skips it.
const cacheToken = 'gtm_' + targetId + '_' + getTimestamp();

injectScript(url, function() {
  logToConsole('[Tatvic] Container GTM-T32XGF8F loaded successfully.');
  data.gtmOnSuccess();
}, function() {
  logToConsole('[Tatvic] Failed to load container GTM-T32XGF8F.');
  data.gtmOnFailure();
}, cacheToken);

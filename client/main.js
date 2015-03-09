var assert = require('assert'),
    conjur = require('conjur-api'),
    netrc = require('netrc'),
    restler = require('restler'),
    format = require('util').format,
    url = require('url'),
    yaml = require('js-yaml'),
    fs = require('fs');

// Obtain configuration from ~/.conjurrc.
// Obtain authentication from ~/.netrc or CONJUR_AUTHN_LOGIN and CONJUR_AUTHN_API_KEY.

var filename = process.env.CONJURRC || process.env.HOME + '/.conjurrc';

console.log("Loading Conjur configuration from %s. Set CONJURRC env to use a different file", filename);

if (!fs.existsSync(filename)) {
    console.log('File does not exist: ' + filename);
    process.exit(1);
}

try {
    var settings = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
} catch (e) {
    console.log('Can`t load conjurrc file: ' + e);
    process.exit(1);
}

var applianceURL = settings['appliance_url'];
var baseUrl = url.parse(applianceURL);
baseUrl = baseUrl.protocol + '//' + baseUrl.host + '/';

var machine = baseUrl + 'api/authn';
var credentials = netrc()[machine];

var gatekeeper = process.env['GATEKEEPER'],
	login = process.env['CONJUR_AUTHN_LOGIN'],
  password = process.env['CONJUR_AUTHN_API_KEY'],
  account = settings['account'];

if ( credentials ) {
	if ( !login ) login = credentials.login;
	if ( !password ) password = credentials.password;
}

console.log('=========================================================================');
console.log('Appliance url:', applianceURL);
console.log('Base url:', baseUrl);
console.log('Machine url:', machine);
console.log('Account:', account);
console.log('Login:', login);
console.log('Password:', password ? 'available' : 'unavailable');
console.log('Gatekeeeper:', gatekeeper);
console.log('=========================================================================');
console.log();

// Trust the Conjur certificate file for TLS
// (otherwise you'll get a TLS_REJECT_UNAUTHORIZED error)
var opts = require('https').globalAgent.options;
opts.ca = fs.readFileSync(settings['cert_file'], 'utf8');

var endpoints = conjur.config.applianceEndpoints(applianceURL, account);

conjur.authn
	.connect(endpoints.authn(account))
	.authenticate(login, password, function(result, token) {
	    assert(token);
	    
	    var options = {
	    		headers: {
	    			"Authorization": conjur.authn.tokenHeader(token)
	    		}
	    }
	    restler.get(format("http://%s/say", gatekeeper), options).on('complete', function(result) {
	      if (result instanceof Error) {
	        console.log('Error:', result.message);
	      } else {
	        console.log(result);
	      }
	    });
	});

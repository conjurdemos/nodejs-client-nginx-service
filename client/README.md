# Overview

This is a node.js client program which calls the web service `ws` through the `gatekeeper`. 

It does this by:

* Configuring a Conjur connection.
* Obtaining an [authentication](http://developer.conjur.net/reference/services/authentication/authenticate.html) token 
from Conjur using a login and password/api_key.
* Providing this token as the `Authorization` header to the gatekeeper.

If the user (you) has the necessary privilege on the gatekeeper, the request is forwarded to the 
web service, and the phrase "Good day!" is printed to the console.

# Running

Run with default settings, specifying the hostname of the `gatekeeper`. The Conjur configuration
and authentication are loaded from `~/.conjurrc` and `~/.netrc`. You can override this using
environment variables; see the source code of `main.js`.

    $ GATEKEEPER=$(boot2docker ip):8080 node main.js 
    Loading Conjur configuration from /Users/kgilpin/accounts/conjurops/.conjurrc. Set CONJURRC env to use a different file
    =========================================================================
    Appliance url: https://conjur-master.itp.conjur.net/api
    Base url: https://conjur-master.itp.conjur.net/
    Machine url: https://conjur-master.itp.conjur.net/api/authn
    Account: conjurops
    Login: kgilpin
    Password: available
    Gatekeeeper: 192.168.59.103:8080
    =========================================================================
    
    info: POST https://conjur-master.itp.conjur.net/api/authn/users/kgilpin/authenticate
    Good day!

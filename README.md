# Overview

This repo demonstrates a Node.js client connecting to a protected back-end web service through
an authorization gatekeeper. The gatekeeper uses Conjur to ensure that only authenticated and
authorized traffic is allowed through to the web service.

It works like this:

* The protected Web Service is launched in Docker. It doesn't expose any public ports.
* A Conjur [resource](http://developer.conjur.net/reference/services/authorization/resource) is created to protect the web service.
* The Gatekeeper is configured with Conjur connection info and the id of the resource.
* The Gatekeeper is allowed to make requests to the Web Service.
* A client Node.js program starts by [authenticating](http://developer.conjur.net/reference/services/authentication/authenticate.html) to Conjur, receiving a Conjur auth token
(aka "bearer token").
* The Node.js client makes a request to the Gatekeeper, providing the bearer token in the HTTP Authorization header.
* The Gatekeeper uses the bearer token to authenticate and authorize the client to Conjur.
* If successful, the request is forwarded to the Web Service, and the client receives the response.
* If the client is unauthenticated or unauthorized, an appropriate HTTP status code is returned to the client.

# Running

## Create the Conjur Gatekeeper resource

Access to the gatekeeper is controlled by a Conjur resource. Each Conjur resource can be the subject of a 
[permission check](https://developer.conjur.net/reference/services/authorization/resource/check.html). For this demo,
the client will be required to have `execute` privilege on the resource that we define here.

Conjur records (resources and higher-level records like hosts, groups, and layers) are organized into "policies".
Each policy is a set of records that are designed to work together. A policy is created by a simple convention
of a common naming prefix. For development sandboxes, the typical policy id is formed from your username and the
hostname of your computer.

Define the policy id in a shell variable:

    $ policy_id=$USER@$HOSTNAME
    $ echo $policy_id
    kgilpin@spudling.local
    
Now, create the Conjur resource using the policy id prefix:

    $ conjur resource create webservice:$policy_id/nodejs-to-nginx-1.0/ws
    Resource created

**Note** For production use, you will always define a resource owner using the `--as-group` option. For development
sandboxes, you can omit this option. As a result, you (not a group) become the owner of all the records that you create.

## Run the Web Service

This demo includes a simple Web Service which runs in Docker. It's just an Nginx server with a Lua script that prints
out "Good day!" when it receives a GET request to the URL `/say`. You can print the Nginx configuration, it's very simple:

    $ cat ws/nginx.conf
    # Docker containers should log to stdout and/or stderr.
    error_log stderr notice;
    
    server {
      location = /say {
        content_by_lua 'ngx.say("Good day!")';
      }
    }

Run the Web Service as a background (daemon) process:

    $ docker run -d --name nodejs-to-nginx-ws conjurdemos/nodejs-to-nginx-ws
    29f73e2076b7cca44048d846376e7c40565f0f933422e59919c1422ea5c21c09

In the container, Nginx is listening to port 80. But no ports are exposed through Docker, so the Web Service is 
unreachable. We will expose it through the Gatekeeper.

## Run the Gatekeeper

The Gatekeeper is also an Nginx server. It's configured to intercept all requests and authorize them using the 
Conjur resource we defined earlier. Authorized requests are forwarded to the Web Service.

So now we will run the Gatekeeper, linking the name `ws` to the Web Service, and providing the Conjur configuration 
and SSL certificate:

First, run it in the foreground to make sure the configuration and startup is successful. The gatekeeper needs to be able
to connect to Conjur. To make this possible, we provide it with two files:

* `/etc/conjur.conf` A Conjur configuration file, is created by the [conjur init](https://developer.conjur.net/reference/tools/init.html) command.
* `/etc/conjur.pem` The Conjur SSL certificate. This file is also created and installed by [conjur init](https://developer.conjur.net/reference/tools/init.html).

You should have both of these files in your home directory. Try this command, and you should see similar YAML output:

    $ cat ~/.conjurrc
    ---
    account: yourorg
    plugins:
    - ui
    appliance_url: https://conjur.yourorg.com/api
    cert_file: /Users/kgilpin/conjur-yourorg.pem

We will provide both the config file and the certificate to the container using Docker volume linking. First,
setup two shell variables:

    $ conjurrc="$HOME/.conjurrc"
    $ conjurpem="$HOME/conjur-yourorg.pem" <-- Change this to match your actual certificate name

Now, run Docker in foreground mode to test that the configuration is working properly:    
   
    $ docker run --link nodejs-to-nginx-ws:ws \
      --rm \
      -it \
      -v $conjurrc:/etc/conjur.conf \
      -v $conjurpem:/etc/conjur.pem \
      -e CONJUR_POLICY_ID=$policy_id \
      -p 8080:80 \
      --name nodejs-to-nginx-gatekeeper \
      conjurdemos/nodejs-to-nginx-gatekeeper
    Starting nginx...

If there's a configuration problem, you should get an error message which you can troubleshoot.

Now that the gatekeeper is properly configured, run it as a background service (daemon mode). All the options are 
the same, except we use `-d`:

    $ docker run --link nodejs-to-nginx-ws:ws \
      -d \
      -v $conjurrc:/etc/conjur.conf \
      -v $conjurpem:/etc/conjur.pem \
      -e CONJUR_POLICY_ID=$policy_id \
      -p 8080:80 \
      --name nodejs-to-nginx-gatekeeper \
      conjurdemos/nodejs-to-nginx-gatekeeper
    064a8dc1a6e11e87140dbe943c34ded9fcafb226b5fd6e922d2499e2ea7e2384

## Run the client

The Node.js client looks up your Conjur login credentials which are cached in `~/.netrc`. It passes your login name and 
API key to the [authenticate](https://developer.conjur.net/reference/services/authentication/authenticate.html) method,
which returns a bearer token.

**Note** A bearer token is a cryptographically signed authentication token. It has a limited lifespan, and it can be
accepted and authenticated by all Conjur services.

Run the Node.js client, providing the hostname of the Gatekeeper:

    $ GATEKEEPER=$(boot2docker ip):8080 node client/main.js
    =========================================================================
    Appliance url: https://conjur.yourcorp.com/api
    Base url: https://conjur.yourcorp.com/
    Machine url: https://conjur.yourcorp.com/api/authn
    Account: yourcorp
    Login: kgilpin
    Password: available
    Gatekeeeper: 192.168.59.103:8080
    =========================================================================
    Obtaining bearer token for login name kgilpin
    info: POST https://conjur.yourcorp.com/api/authn/users/kgilpin/authenticate
    Obtained token for kgilpin with timestamp 2015-03-10 14:44:48 UTC
    Sending GET request to http://192.168.59.103:8080/say, providing Conjur token in the Authorization header
    Received response from the Gatekeeper:
    Good day!

The client has authenticated, send a request to the Gatekeeper using the bearer token, and received a response from the
Web Service.

## Audit

Conjur records each permission check. You can view the audit records in the Conjur UI, or from the command-line.

View the Conjur audit records associated with the protected resource:

    $ conjur audit resource -s webservice:$policy_id/nodejs-to-nginx-1.0/ws
    [2015-03-09 18:59:27 UTC] yourcorp:user:kgilpin created resource yourcorp:webservice:kgilpin@spudling/nodejs-to-nginx-1.0/ws owned by yourcorp:user:kgilpin
    [2015-03-09 20:19:55 UTC] yourcorp:user:kgilpin checked that they can execute yourcorp:webservice:kgilpin@spudling/nodejs-to-nginx-1.0/ws (true)

The creation event of the resource is recorded, as well as the permission check performed by the Gatekeeper.

## Run the client using a Host identity

### Create the records and permissions

You just ran the client program using your own identity. In a real scenario, the clients will have their own identity.
Clients can be Conjur Users or Hosts. Here we will show how to assign Host identity to clients, and give them permission
to use the Web Service.

Create a Conjur Layer to which all clients will belong.

    $ conjur layer create $policy_id/nodejs-to-nginx-1.0/clients
    {
      "id": "kgilpin@spudling-2.local/nodejs-to-nginx-1.0/clients",
      ...
      "hosts": [
    
      ]
    }

Now, give the Layer permission to use the Web Service:

    $ conjur resource permit webservice:$policy_id/nodejs-to-nginx-1.0/ws layer:$policy_id/nodejs-to-nginx-1.0/clients execute
    Permission granted
    
Next, create a Host to represent a remote client, and save the command output in a file:

    $ conjur host create $policy_id/nodejs-to-nginx-1.0/hosts/0 | tee host.json
    {
      "id": "kgilpin@spudling-2.local/nodejs-to-nginx-1.0hosts/0",
      ...
      "api_key": "23xjepa2tgtqwp353zdqn2swrkezvd2zpc3jrqe922rcz3gy21sw84h"
    }

Add the Host to the Layer:

    $ conjur layer hosts add $policy_id/nodejs-to-nginx-1.0/clients $policy_id/nodejs-to-nginx-1.0/hosts/0
    Host added

The host is in the layer now:

    $ conjur layer show $policy_id/nodejs-to-nginx-1.0/clients
    {
      "id": "kgilpin@spudling-2.local/nodejs-to-nginx-1.0/clients",
      ...
      "hosts": [
        "yourcorp:host:kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0"
      ]
    }
      
And, both the host and the layer have permission to `execute` the resource:

    $ conjur resource permitted_roles webservice:$policy_id/nodejs-to-nginx-1.0/ws execute
    [
      "yourcorp:user:kgilpin",
      "yourcorp:layer:kgilpin@spudling-2.local/nodejs-to-nginx-1.0/clients",
      "yourcorp:host:kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0"
    ]

### Run the client with the Host identity

Now it's time to run the client program again. This time, we won't use the cached Conjur credentials in
`~/.netrc`. Instead, we will provide the host credentials (login name and API key) via environment variables.

    $ host_id=$(cat host.json | jsonfield id)
    $ echo $host_id  
    kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0
    
    $ host_api_key=$(cat host.json | jsonfield api_key)
    $ echo $host_api_key
    23xjepa2tgtqwp353zdqn2swrkezvd2zpc3jrqe922rcz3gy21sw84h

With the credentials loaded into shell variables, run the client again:

    $ CONJUR_AUTHN_LOGIN=host/$host_id CONJUR_AUTHN_API_KEY=$host_api_key GATEKEEPER=$(boot2docker ip):8080 node client/main.js
    =========================================================================
    Appliance url: https://conjur.yourcorp.com/api
    Base url: https://conjur.yourcorp.com/
    Machine url: https://conjur.yourcorp.com/api/authn
    Account: yourcorp
    Login: host/kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0
    Password: available
    Gatekeeeper: 192.168.59.103:8080
    =========================================================================
    Obtaining bearer token for login name host/kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0
    info: POST https://conjur.yourcorp.com/api/authn/users/host%2Fkgilpin%40spudling-2.local%2Fnodejs-to-nginx-1.0%2Fhosts%2F0/authenticate
    Obtained token for host/kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0 with timestamp 2015-03-10 14:59:22 UTC
    Sending GET request to http://192.168.59.103:8080/say, providing Conjur token in the Authorization header
    Received response from the Gatekeeper:
    Good day!
    
### De-authorized the Host

If the Host is removed from the Layer, it will lose its privileges to the Gatekeeper.

    $ conjur layer hosts remove $policy_id/nodejs-to-nginx-1.0/clients $policy_id/nodejs-to-nginx-1.0/hosts/0
    Host removed
    
    $ CONJUR_AUTHN_LOGIN=host/$host_id CONJUR_AUTHN_API_KEY=$host_api_key GATEKEEPER=$(boot2docker ip):8080 node client/main.js
    ...
    Received response from the Gatekeeper:
    <html>
    <head><title>403 Forbidden</title></head>
    <body bgcolor="white">
    <center><h1>403 Forbidden</h1></center>
    <hr><center>nginx/1.7.10</center>
    </body>
    </html>

The unauthorized access attempt is recorded in the Conjur audit:

    $ conjur audit resource -s webservice:$policy_id/nodejs-to-nginx-1.0/ws
    ...
    [2015-03-10 15:02:00 UTC] yourcorp:host:kgilpin@spudling-2.local/nodejs-to-nginx-1.0/hosts/0 checked that they can execute yourcorp:webservice:kgilpin@spudling-2.local/nodejs-to-nginx-1.0/ws (false)

# Production Use

Several notes, for production use:

* When creating a Conjur record such as the Resource, always use the `--as-group` option to assign ownership of the 
new record to a group.
* In production, use the luajit version of lua, which must be compiled along with nginx from source.

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

Run the Web Service: 

  $ docker run -d --name nodejs-to-nginx-ws conjurdemos/nodejs-to-nginx-ws

Create the Conjur resource:

    $ policy_id=$USER@$HOSTNAME
    $ conjur resource create webservice:$policy_id/nodejs-to-nginx-1.0/ws
    Resource created

Run the Gatekeeper, linking the name `ws` to the Web Service, and providing the Conjur configuration and SSL certificate:

    $ docker run --link nodejs-to-nginx-ws:ws \
      -d \
      -v $PWD/conjur.pem:/etc/conjur.pem \
      -v $PWD/.conjurrc:/etc/conjur.conf \
      -e CONJUR_POLICY_ID=$policy_id \
      -p 8080:80 \
      --name nodejs-to-nginx-gatekeeper \
      conjurdemos/nodejs-to-nginx-gatekeeper

Run the Node.js client:

    $ GATEKEEPER=$(boot2docker ip):8080 node client/main.js
    ... various info ...
    Good day!

View the Conjur audit:

    $ conjur audit resource -s webservice:kgilpin@spudling/nodejs-client-nginx-service-1.0/ws
    [2015-03-09 18:59:27 UTC] conjurops:user:kgilpin created resource conjurops:webservice:kgilpin@spudling/nodejs-client-nginx-service-1.0/ws owned by conjurops:user:kgilpin
    [2015-03-09 20:19:55 UTC] conjurops:user:kgilpin checked that they can execute conjurops:webservice:kgilpin@spudling/nodejs-client-nginx-service-1.0/ws (true)

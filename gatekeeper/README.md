# Overview

This is an HTTP auth gatekeeper, powered by Nginx.
This service intercepts all requests, and authenticates and authorizes those requests
against a Conjur endpoint. 

Permitted traffic is forwarded to an external web service; see `../ws`.

# Configuration

The Gatekeeper authorizes the request against a Conjur resource, specifically
a `webservice` called `$policy_id/nodejs-client-nginx-service-1.0/ws`. The 
`policy_id` is used to keep "environments" (developer sandbox, staging, production)
distinct from each other.

    $ policy_id=$USER@$HOSTNAME
    $ conjur resource create webservice:$policy_id/nodejs-client-nginx-service-1.0/ws
    Resource created

# Launching the Gatekeeper

    $ docker run --link nodejs_client_nginx_service_ws:ws \
      -d \
      -v $PWD/conjur.pem:/etc/conjur.pem \
      -v $PWD/.conjurrc:/etc/conjur.conf \
      -e CONJUR_POLICY_ID=$policy_id \
      -p 8080:80 \
      --name nodejs_client_nginx_service_gatekeeper \
      nodejs_client_nginx_service_gatekeeper

# Connecting to the Gatekeeper

A Conjur auth token is expected in the `Authorization` header. This token can be obtained
from the REST API, or using the CLI:

    $ token=$(conjur authn authenticate -H)

Once obtained, this token can passed to the gatekeeper:

    $ curl -H "$token" $(boot2docker ip):8080/say
    Good day!

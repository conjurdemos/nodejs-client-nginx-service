# Overview

This is a simple "web service", which is actually an Nginx server using `content_by_lua`.
Its purpose is to sit behind an authentication and authorization gatekeeper (see `../gatekeeper'),
which gates the allowed requests.

The server exposes a single route `/say`, which prints a plain-text message to the response.

# Build

  $ docker build -t nodejs_client_nginx_service_ws .

# Run

  $ docker run -d --name nodejs_client_nginx_service_ws nodejs_client_nginx_service_ws

Because we are not exposing any ports externally, there's no way to send any requests
to this web service. You must go through the `../gatekeeper`! 

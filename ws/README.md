# Overview

This is a simple "web service", which is actually an Nginx server using `content_by_lua`.
Its purpose is to sit behind an authentication and authorization gatekeeper (see `../gatekeeper'),
which gates the allowed requests.

The server exposes a single route `/say`, which prints a plain-text message to the response.

# Build

  $ docker build -t nodejs_client_nginx_service_ws .

# Test

  $ docker run -d -p 8080:80 nodejs_client_nginx_service_ws
  $ curl http://$(boot2docker ip):8080/say
  It works!
  
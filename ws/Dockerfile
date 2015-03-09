FROM ubuntu:14.04
MAINTAINER Conjur Inc

RUN apt-get update
RUN apt-get install -y nginx nginx-extras

EXPOSE 80

ADD nginx.conf /etc/nginx/sites-enabled/default

CMD ["nginx", "-g", "daemon off;"]

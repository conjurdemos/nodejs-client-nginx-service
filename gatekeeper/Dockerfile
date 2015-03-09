FROM ubuntu:14.04
MAINTAINER Conjur Inc

RUN apt-get update && \
  apt-get install -y python3-software-properties software-properties-common && \
  apt-add-repository ppa:nginx/development
RUN apt-get update && \
  apt-get install -y nginx-extras ruby2.0

EXPOSE 80

ADD nginx.conf /nginx.conf.template

ADD launch /launch

CMD ["/launch"]

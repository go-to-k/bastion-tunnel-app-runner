FROM ubuntu:20.04

WORKDIR /

RUN \
    --mount=type=cache,target=/var/lib/apt/lists \
    --mount=type=cache,target=/var/cache/apt/archives \
    apt-get update \
    && apt-get -y install \
    curl \
    jq \
    unzip \
    netcat

RUN curl https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip ./aws

RUN curl https://s3.ap-northeast-1.amazonaws.com/amazon-ssm-ap-northeast-1/latest/debian_amd64/amazon-ssm-agent.deb -o /tmp/amazon-ssm-agent.deb \
    && dpkg -i /tmp/amazon-ssm-agent.deb \
    && mv /etc/amazon/ssm/amazon-ssm-agent.json.template /etc/amazon/ssm/amazon-ssm-agent.json \
    && mv /etc/amazon/ssm/seelog.xml.template /etc/amazon/ssm/seelog.xml \
    && rm /tmp/amazon-ssm-agent.deb

COPY ./scripts/deploy_scripts/run.sh /run.sh

EXPOSE 8080

CMD ["bash", "/run.sh"]
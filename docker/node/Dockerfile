ARG NODE_VERSION=16.15.1

FROM node:${NODE_VERSION}

ARG GOLANG_VERSION=1.16.15

ARG APP_HOME=/app
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# install some packages to use
RUN apt-get update \
  && apt-get -y install --no-install-recommends \
  curl \
  vim

# Create a non-root user to use if preferred - see https://aka.ms/vscode-remote/containers/non-root-user.
RUN apt-get install --no-install-recommends -y \
  sudo \
  # Create a non-root user to use if preferred - see https://aka.ms/vscode-remote/containers/non-root-user.
  && if [ "$USER_GID" != "1000" ]; then groupadd -o --gid $USER_GID $USERNAME; fi \
  && if [ "$USER_UID" != "1000" ]; then useradd -o -s /bin/bash --uid $USER_UID --gid $USER_GID -m $USERNAME; fi \
  # [Optional] Add sudo support for the non-root user
  && apt-get install -y sudo \
  && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME\
  && chmod 0440 /etc/sudoers.d/$USERNAME

# 日本語が使えるようにする
ENV DEBIAN_FRONTEND noninteractive

RUN apt-get install -y locales
RUN locale-gen ja_JP.UTF-8

ENV LANG ja_JP.UTF-8
ENV LC_CTYPE ja_JP.UTF-8
RUN localedef -f UTF-8 -i ja_JP ja_JP.utf8

# cleaning up unused files
RUN apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*

# golang
RUN curl -Ls -o go.tar.gz https://go.dev/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz \
  && tar -C /usr/local -xzf go.tar.gz \
  && rm go.tar.gz
ENV PATH $PATH:/usr/local/go/bin
RUN go env -w GO111MODULE=on

WORKDIR ${APP_HOME}
# gopls
COPY go.mod ${APP_HOME}
RUN go get -v golang.org/x/tools/gopls

# npm
COPY package.json ${APP_HOME}
COPY package-lock.json ${APP_HOME}
COPY .husky/ ${APP_HOME}/.husky/
COPY src/ ${APP_HOME}/src/
RUN chown -R $USERNAME:$USERNAME ${APP_HOME}

USER $USERNAME
RUN npm install

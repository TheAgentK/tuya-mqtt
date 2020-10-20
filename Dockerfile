FROM node

ARG BRANCH=master

RUN git clone --single-branch --branch ${BRANCH} https://github.com/TheAgentK/tuya-mqtt.git && \
    cd tuya-mqtt && \
    npm install

WORKDIR /tuya-mqtt

COPY config.json .

ENV DEBUG=tuya-mqtt:*

ENTRYPOINT ["node", "tuya-mqtt.js"]

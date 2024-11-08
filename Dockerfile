FROM node
WORKDIR /app
COPY . .
RUN npm install
VOLUME /app/configs
ENTRYPOINT npm start
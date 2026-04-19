FROM nginx:alpine
COPY . /usr/share/nginx/html

# Replace default nginx config to use port 8080

RUN rm /etc/nginx/conf.d/default.conf
RUN printf "server { listen 8080; location / { root /usr/share/nginx/html; index index.html; } }" > /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]

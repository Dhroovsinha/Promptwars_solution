# VenueFlow — Cloud Run Dockerfile
# Lightweight nginx serving static files with dynamic PORT support

FROM nginx:alpine

# Remove default nginx config and html
RUN rm /etc/nginx/conf.d/default.conf && rm -rf /usr/share/nginx/html/*

# Copy custom nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy app files into nginx serve directory
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080

# Expose the port (documentation only — Cloud Run uses PORT)
EXPOSE 8080

# nginx:alpine uses envsubst to process .template files on startup
# The default entrypoint handles PORT substitution automatically
CMD ["nginx", "-g", "daemon off;"]

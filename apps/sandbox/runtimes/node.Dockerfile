# Horizon Sandbox — Node.js Runtime
# Node 20 with common utility libraries

FROM node:20-slim

# Prevent npm update checks and reduce noise
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NODE_ENV=production

# Install common libraries globally and locally
RUN npm install -g \
    pptxgenjs \
    axios \
    lodash \
    moment \
    csv-parser \
    json2csv \
    && mkdir -p /tmp/libs \
    && cd /tmp/libs \
    && npm install \
        pptxgenjs \
        axios \
        lodash \
        moment \
        csv-parser \
        json2csv

# Create non-root user
RUN useradd -m -s /bin/bash runner

# Set working directory
WORKDIR /tmp

# Make global modules available to runner
ENV NODE_PATH=/usr/local/lib/node_modules:/tmp/libs/node_modules

USER runner

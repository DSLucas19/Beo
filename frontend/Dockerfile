# Use Node 18 Alpine as base image
FROM node:18-alpine

# Set work directory
WORKDIR /frontend

# Copy package files
COPY package*.json /frontend/

# Install dependencies
RUN npm install

# Copy project files
COPY . /frontend/

# Expose port 3000
EXPOSE 3000

# Start Vite dev server with host binding
CMD ["npm", "run", "dev"]

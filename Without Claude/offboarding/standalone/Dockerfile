# NOT TESTED HERE. docker build -t ae-hub . && docker run -d -p 8080:8080 -v ae-hub-data:/app/data -e HUB_USER=team -e HUB_PASSWORD=CHANGE-ME ae-hub
FROM python:3.12-slim
WORKDIR /app
COPY . /app
RUN python3 make_standalone.py
EXPOSE 8080
VOLUME /app/data
CMD ["python3", "server.py", "--host", "0.0.0.0", "--port", "8080"]

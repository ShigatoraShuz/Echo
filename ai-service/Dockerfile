FROM python:3.12-slim
WORKDIR /app
COPY app ./app
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .
USER nobody
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

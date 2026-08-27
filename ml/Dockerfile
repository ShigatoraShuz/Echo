FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY ml/pyproject.toml ./
COPY ml/app ./app
RUN pip install --no-cache-dir .
USER nobody
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

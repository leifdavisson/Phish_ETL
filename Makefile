.PHONY: help dev test

help:
    @echo "make dev   - start docker services"
    @echo "make test  - run tests (once backend exists)"

dev:
    docker compose up --build

test:
    @echo "No tests yet. Next commit will add backend + pytest."

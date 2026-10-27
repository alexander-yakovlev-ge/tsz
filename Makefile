# Команды проекта. Нужны только Docker и Docker Compose (plan.md, разд. 1.2).
# Полная приёмка этапа: make accept.

COMPOSE := docker compose
COMPOSE_DEV := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
TOOLS := $(COMPOSE) --profile tools run --rm --build tools

.DEFAULT_GOAL := help
.PHONY: help up down reset restart ps logs test check e2e smoke fixtures psql cert dev accept

help: ## Список команд
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

.env:
	cp .env.example .env
	@echo "Создан .env из .env.example — смените пароли перед использованием вне локальной машины."

up: .env ## Собрать и запустить стек, дождаться healthy
	$(COMPOSE) up -d --build --wait

down: ## Остановить стек (данные сохраняются)
	$(COMPOSE) down

reset: ## Удалить контейнеры и все данные (тома БД, файлов, Caddy)
	$(COMPOSE) --profile test --profile tools down -v --remove-orphans

restart: ## Перезапустить сервисы (данные сохраняются) и дождаться healthy
	$(COMPOSE) stop
	$(COMPOSE) up -d --wait

ps: ## Состояние сервисов
	$(COMPOSE) ps

logs: ## Логи всех сервисов
	$(COMPOSE) logs -f --tail=100

test: .env ## Модульные и интеграционные тесты в контейнере
	$(TOOLS) pnpm test

check: .env ## Prettier, ESLint, typecheck в контейнере
	$(TOOLS) pnpm check

e2e: ## E2E-тесты Playwright против развёрнутого стека
	$(COMPOSE) --profile test run --rm --build e2e

smoke: ## Smoke-проверка развёрнутого стека
	$(COMPOSE) --profile test run --rm smoke

fixtures: .env ## Сгенерировать синтетические тестовые данные в data/fixtures
	$(TOOLS) pnpm --filter @tsz/fixtures generate

psql: ## Консоль PostgreSQL
	$(COMPOSE) exec postgres psql -U tsz -d tsz

cert: ## Экспортировать корневой сертификат Caddy в caddy-root.crt
	$(COMPOSE) cp proxy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
	@echo "Добавьте caddy-root.crt в доверенные корневые сертификаты системы/браузера."

dev: .env ## Запуск в режиме разработки (hot reload)
	$(COMPOSE_DEV) up -d --build --wait

accept: reset up fixtures check test e2e smoke restart ## Полная приёмка этапа с нуля
	$(COMPOSE) --profile test run --rm smoke
	@echo "Приёмка: все шаги пройдены. Осталась ручная проверка по чек-листу этапа."

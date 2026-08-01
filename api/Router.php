<?php

/**
 * Простой роутер для обработки HTTP-запросов
 */
class Router {
    private $routes = [];

    /**
     * Регистрация GET-роута
     */
    public function get($pattern, $controller, $method) {
        $this->addRoute('GET', $pattern, $controller, $method);
    }

    /**
     * Регистрация POST-роута
     */
    public function post($pattern, $controller, $method) {
        $this->addRoute('POST', $pattern, $controller, $method);
    }

    /**
     * Регистрация PATCH-роута
     */
    public function patch($pattern, $controller, $method) {
        $this->addRoute('PATCH', $pattern, $controller, $method);
    }

    /**
     * Регистрация DELETE-роута
     */
    public function delete($pattern, $controller, $method) {
        $this->addRoute('DELETE', $pattern, $controller, $method);
    }

    /**
     * Добавление роута в реестр
     */
    private function addRoute($httpMethod, $pattern, $controller, $method) {
        $this->routes[] = [
            'method' => $httpMethod,
            'pattern' => $pattern,
            'controller' => $controller,
            'action' => $method
        ];
    }

    /**
     * Обработка входящего запроса
     */
    public function dispatch($requestMethod, $path) {
        foreach ($this->routes as $route) {
            // Проверка HTTP-метода
            if ($route['method'] !== $requestMethod) {
                continue;
            }

            // Преобразуем паттерн в регулярное выражение
            $pattern = preg_replace('/\{(\w+)\}/', '([^/]+)', $route['pattern']);
            $pattern = '#^' . $pattern . '$#';

            // Проверка совпадения пути
            if (preg_match($pattern, $path, $matches)) {
                array_shift($matches); // Убираем полное совпадение

                // Вызов метода контроллера
                $controller = new $route['controller']();
                $action = $route['action'];
                return call_user_func_array([$controller, $action], $matches);
            }
        }

        // 404 - роут не найден
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        exit();
    }
}

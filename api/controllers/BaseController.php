<?php

/**
 * Базовый класс контроллера с общими методами
 */
abstract class BaseController {

    /**
     * Получение JSON из тела запроса
     * @return array Декодированный JSON или пустой массив
     */
    protected function getInput() {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }

    /**
     * Отправка успешного JSON ответа
     * @param mixed $data Данные для отправки
     * @param int $statusCode HTTP статус код (по умолчанию 200)
     */
    protected function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit();
    }

    /**
     * Отправка JSON ответа с ошибкой
     * @param string $message Сообщение об ошибке
     * @param int $statusCode HTTP статус код (по умолчанию 400)
     */
    protected function sendError($message, $statusCode = 400) {
        http_response_code($statusCode);
        echo json_encode(['error' => $message]);
        exit();
    }
}

<?php

// Singleton-обёртка над php-redis. Один экземпляр соединения на весь запрос,
// по аналогии с Database.php.
class RedisClient {
    private static $instance = null;
    private $connection;
    private $available = true;

    private function __construct() {
        $config = require __DIR__ . '/../../config/config.php';
        $redisConfig = $config['redis'];

        try {
            $this->connection = new \Redis();
            $this->connection->connect(
                $redisConfig['host'],
                $redisConfig['port'],
                $redisConfig['timeout']
            );
        } catch (\RedisException $e) {
            // Redis используется только для эфемерных данных (просмотры, presence, typing),
            // поэтому его недоступность не должна валить весь запрос.
            error_log("Redis connection error: " . $e->getMessage());
            $this->available = false;
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function isAvailable() {
        return $this->available;
    }

    public function getConnection() {
        return $this->connection;
    }
}

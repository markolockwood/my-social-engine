<?php

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/Post.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

/**
 * Контроллер для работы с постами
 */
class PostController {

    /**
     * GET /posts — лента постов (с пагинацией)
     */
    public function index() {
        $authUser = AuthMiddleware::getAuthUser();
        $userId = $authUser ? $authUser['userId'] : null;

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $post = new Post();
        $posts = $post->getFeed($userId, $limit, $offset);

        $this->sendResponse(['posts' => $posts]);
    }

    /**
     * POST /posts — создание нового поста
     */
    public function create() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $parentId = isset($input['parent_id']) ? (int)$input['parent_id'] : null;
        $isQuickReply = isset($input['is_quick_reply']) && $input['is_quick_reply'] ? true : false;

        $post = new Post();
        $postId = $post->create($authUser['userId'], $input['content'] ?? '', $parentId, $isQuickReply);

        $postData = $post->getById($postId, $authUser['userId']);

        $this->sendResponse(['post' => $postData], 201);
    }

    /**
     * GET /posts/{id} — получение одного поста
     */
    public function show($id) {
        $authUser = AuthMiddleware::getAuthUser();
        $userId = $authUser ? $authUser['userId'] : null;

        $post = new Post();
        $postData = $post->getById($id, $userId);

        $this->sendResponse(['post' => $postData]);
    }

    /**
     * DELETE /posts/{id} — удаление поста
     */
    public function delete($id) {
        $authUser = AuthMiddleware::requireAuth();

        $post = new Post();
        $post->delete($id, $authUser['userId']);

        $this->sendResponse(['message' => 'Post deleted successfully']);
    }

    /**
     * POST /posts/{id}/like — поставить лайк
     */
    public function like($id) {
        $authUser = AuthMiddleware::requireAuth();

        $post = new Post();
        $post->like($id, $authUser['userId']);

        $this->sendResponse(['message' => 'Post liked successfully']);
    }

    /**
     * POST /posts/{id}/unlike — убрать лайк
     */
    public function unlike($id) {
        $authUser = AuthMiddleware::requireAuth();

        $post = new Post();
        $post->unlike($id, $authUser['userId']);

        $this->sendResponse(['message' => 'Post unliked successfully']);
    }

    /**
     * GET /posts/{id}/replies — ответы на пост
     */
    public function replies($id) {
        $authUser = AuthMiddleware::getAuthUser();
        $userId = $authUser ? $authUser['userId'] : null;

        $post = new Post();
        $replies = $post->getReplies($id, $userId);

        $this->sendResponse(['posts' => $replies]);
    }

    /**
     * POST /posts/{id}/retweet — ретвит
     */
    public function retweet($id) {
        $authUser = AuthMiddleware::requireAuth();

        $post = new Post();
        $post->retweet($id, $authUser['userId']);

        $this->sendResponse(['message' => 'Post retweeted successfully']);
    }

    /**
     * POST /posts/{id}/unretweet — убрать ретвит
     */
    public function unretweet($id) {
        $authUser = AuthMiddleware::requireAuth();

        $post = new Post();
        $post->unretweet($id, $authUser['userId']);

        $this->sendResponse(['message' => 'Post unretweeted successfully']);
    }

    /**
     * POST /posts/{id}/view — увеличить счётчик просмотров
     */
    public function view($id) {
        $post = new Post();
        $post->incrementViews($id);

        $this->sendResponse(['message' => 'View counted']);
    }

    /**
     * GET /posts/{id}/comments — список комментариев к посту
     */
    public function getComments($id) {
        $post = new Post();
        $comments = $post->getComments($id);

        $this->sendResponse(['comments' => $comments]);
    }

    /**
     * POST /posts/{id}/comments — добавить комментарий
     */
    public function addComment($id) {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();

        $post = new Post();
        $commentId = $post->addComment($authUser['userId'], $id, $input['content'] ?? '');

        $comments = $post->getComments($id);
        $newComment = array_values(array_filter($comments, fn($c) => $c['id'] == $commentId))[0];

        $this->sendResponse(['comment' => $newComment], 201);
    }

    /**
     * DELETE /comments/{id} — удалить комментарий
     */
    public function deleteComment($id) {
        $authUser = AuthMiddleware::requireAuth();

        $post = new Post();
        $post->deleteComment($id, $authUser['userId']);

        $this->sendResponse(['message' => 'Comment deleted successfully']);
    }

    /**
     * Получение JSON из тела запроса
     */
    private function getInput() {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }

    /**
     * Отправка успешного ответа
     */
    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit();
    }
}

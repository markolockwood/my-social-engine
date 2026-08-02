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
        $mediaFiles = isset($input['media_files']) && is_array($input['media_files']) ? $input['media_files'] : [];

        $post = new Post();
        $postId = $post->create($authUser['userId'], $input['content'] ?? '', $parentId, $isQuickReply, $mediaFiles);

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
     * POST /upload/post-images — загрузка изображений для поста (до 4 штук)
     */
    public function uploadPostImages() {
        $authUser = AuthMiddleware::requireAuth();

        if (!isset($_FILES['images']) || empty($_FILES['images']['name'][0])) {
            http_response_code(400);
            echo json_encode(['error' => 'No images uploaded']);
            exit();
        }

        $files = $_FILES['images'];
        $fileCount = count($files['name']);

        if ($fileCount > 4) {
            http_response_code(400);
            echo json_encode(['error' => 'Maximum 4 images allowed']);
            exit();
        }

        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $maxSize = 5 * 1024 * 1024;
        $uploadedUrls = [];

        $uploadDir = __DIR__ . '/../../uploads/posts/';
        $thumbDir = __DIR__ . '/../../uploads/posts/thumbs/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        if (!is_dir($thumbDir)) mkdir($thumbDir, 0755, true);

        for ($i = 0; $i < $fileCount; $i++) {
            if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['error' => "Error uploading image " . ($i + 1)]);
                exit();
            }

            if (!in_array($files['type'][$i], $allowedTypes)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid file type. Allowed: JPEG, PNG, WEBP']);
                exit();
            }

            if ($files['size'][$i] > $maxSize) {
                http_response_code(400);
                echo json_encode(['error' => 'File too large (max 5MB)']);
                exit();
            }

            $ext = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
            $filename = 'post_img_' . time() . '_' . uniqid() . '.' . $ext;

            if (!move_uploaded_file($files['tmp_name'][$i], $uploadDir . $filename)) {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to save image ' . ($i + 1)]);
                exit();
            }

            // Создание миниатюры
            $thumbPath = '/uploads/posts/thumbs/' . $filename;
            $this->createThumbnail($uploadDir . $filename, $thumbDir . $filename, 600);

            $uploadedUrls[] = [
                'url' => '/uploads/posts/' . $filename,
                'thumb' => $thumbPath
            ];
        }

        $this->sendResponse(['urls' => $uploadedUrls], 201);
    }

    /**
     * Создание миниатюры изображения
     */
    private function createThumbnail($source, $dest, $maxWidth) {
        if (!extension_loaded('gd')) return false;

        $info = getimagesize($source);
        if (!$info) return false;

        list($width, $height, $type) = $info;

        if ($width <= $maxWidth) {
            copy($source, $dest);
            return true;
        }

        $ratio = $maxWidth / $width;
        $newWidth = $maxWidth;
        $newHeight = (int)($height * $ratio);

        $srcImage = null;
        switch ($type) {
            case IMAGETYPE_JPEG: $srcImage = imagecreatefromjpeg($source); break;
            case IMAGETYPE_PNG: $srcImage = imagecreatefrompng($source); break;
            case IMAGETYPE_WEBP: $srcImage = imagecreatefromwebp($source); break;
            default: return false;
        }

        if (!$srcImage) return false;

        $dstImage = imagecreatetruecolor($newWidth, $newHeight);

        if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_WEBP) {
            imagealphablending($dstImage, false);
            imagesavealpha($dstImage, true);
        }

        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        switch ($type) {
            case IMAGETYPE_JPEG: imagejpeg($dstImage, $dest, 85); break;
            case IMAGETYPE_PNG: imagepng($dstImage, $dest, 8); break;
            case IMAGETYPE_WEBP: imagewebp($dstImage, $dest, 85); break;
        }

        imagedestroy($srcImage);
        imagedestroy($dstImage);

        return true;
    }

    /**
     * POST /upload/post-gif — загрузка гифки для поста (только одна)
     */
    public function uploadPostGif() {
        $authUser = AuthMiddleware::requireAuth();

        if (!isset($_FILES['gif']) || empty($_FILES['gif']['name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'No GIF uploaded']);
            exit();
        }

        $file = $_FILES['gif'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'Error uploading GIF']);
            exit();
        }

        if ($file['type'] !== 'image/gif') {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type. Only GIF allowed']);
            exit();
        }

        $maxSize = 10 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large (max 10MB)']);
            exit();
        }

        $uploadDir = __DIR__ . '/../../uploads/gifs/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $baseName = 'post_gif_' . time() . '_' . uniqid();
        $gifPath = $uploadDir . $baseName . '.gif';

        if (!move_uploaded_file($file['tmp_name'], $gifPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save GIF']);
            exit();
        }

        // Конвертация GIF в MP4
        $mp4Path = $uploadDir . $baseName . '.mp4';
        $converted = $this->convertGifToMp4($gifPath, $mp4Path);

        if ($converted) {
            // Удаляем оригинальный GIF
            unlink($gifPath);
            $this->sendResponse(['url' => '/uploads/gifs/' . $baseName . '.mp4'], 201);
        } else {
            // Если конвертация не удалась, оставляем GIF
            $this->sendResponse(['url' => '/uploads/gifs/' . $baseName . '.gif'], 201);
        }
    }

    /**
     * Конвертация GIF в MP4 через FFmpeg
     */
    private function convertGifToMp4($gifPath, $mp4Path) {
        // Полный путь к FFmpeg
        $ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

        // Проверка существования FFmpeg
        if (!file_exists($ffmpegPath)) {
            error_log("FFmpeg not found at: $ffmpegPath");
            return false;
        }

        // Конвертация с оптимальными параметрами
        $cmd = sprintf(
            '%s -i %s -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset fast -crf 23 -y %s 2>&1',
            escapeshellarg($ffmpegPath),
            escapeshellarg($gifPath),
            escapeshellarg($mp4Path)
        );

        exec($cmd, $output, $returnCode);

        if ($returnCode !== 0) {
            error_log("FFmpeg conversion failed: " . implode("\n", $output));
            return false;
        }

        $success = file_exists($mp4Path) && filesize($mp4Path) > 0;
        if (!$success) {
            error_log("MP4 file not created or empty");
        }

        return $success;
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

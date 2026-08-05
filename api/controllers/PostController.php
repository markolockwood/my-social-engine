<?php

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/Post.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../middleware/RateLimitMiddleware.php';

/**
 * Контроллер для работы с постами
 */
class PostController {

    private $config;

    public function __construct() {
        $this->config = require __DIR__ . '/../../config/config.php';
    }

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

        // Лимит: 20 постов за 10 минут на пользователя
        RateLimitMiddleware::check('create_post', 20, 600, 'user_' . $authUser['userId']);

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

            // Проверка MIME типа через file content (безопаснее, чем $_FILES['type'])
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $files['tmp_name'][$i]);
            finfo_close($finfo);

            if (!in_array($mimeType, $allowedTypes)) {
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
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

            if (!in_array($ext, $allowedExtensions)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid file extension']);
                exit();
            }

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

        // Регистрируем все изображения как временные загрузки
        try {
            $db = Database::getInstance();
            $trackingId = $_SERVER['HTTP_X_TRACKING_ID'] ?? null;
            foreach ($uploadedUrls as $item) {
                $db->query(
                    "INSERT INTO temp_uploads (user_id, file_path, media_type, tracking_id) VALUES (?, ?, ?, ?)",
                    [$authUser['userId'], $item['url'], 'image', $trackingId]
                );
            }
        } catch (Exception $e) {
            error_log("Failed to register image uploads in temp_uploads: " . $e->getMessage());
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

        // Проверка MIME типа через file content
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if ($mimeType !== 'image/gif') {
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
        $gifPath  = $uploadDir . $baseName . '.gif';

        if (!move_uploaded_file($file['tmp_name'], $gifPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save GIF']);
            exit();
        }

        // Регистрируем СРАЗУ после сохранения (до конвертации), чтобы отмена работала корректно
        $trackingId = $_SERVER['HTTP_X_TRACKING_ID'] ?? null;
        $tempPath   = '/uploads/gifs/' . $baseName . '.gif'; // начальный путь, обновим после конвертации
        try {
            $db = Database::getInstance();
            $db->query(
                "INSERT INTO temp_uploads (user_id, file_path, media_type, tracking_id) VALUES (?, ?, ?, ?)",
                [$authUser['userId'], $tempPath, 'gif', $trackingId]
            );
        } catch (Exception $e) {
            error_log("Failed to register gif upload in temp_uploads: " . $e->getMessage());
        }

        // Конвертация GIF в MP4
        $mp4Path   = $uploadDir . $baseName . '.mp4';
        $converted = $this->convertGifToMp4($gifPath, $mp4Path);

        if ($converted) {
            unlink($gifPath);
            $url = '/uploads/gifs/' . $baseName . '.mp4';
            // Обновляем путь в БД на mp4
            try {
                $db = Database::getInstance();
                $db->query(
                    "UPDATE temp_uploads SET file_path = ? WHERE tracking_id = ? AND user_id = ?",
                    [$url, $trackingId, $authUser['userId']]
                );
            } catch (Exception $e) {
                error_log("Failed to update gif path in temp_uploads: " . $e->getMessage());
            }
        } else {
            $url = '/uploads/gifs/' . $baseName . '.gif';
        }

        $this->sendResponse(['url' => $url], 201);
    }

    /**
     * DELETE /upload/cancel — отмена загрузки по tracking ID
     * Убивает FFmpeg процесс и немедленно удаляет файлы (для Linux)
     */
    public function cancelUpload() {
        $authUser = AuthMiddleware::requireAuth();
        $input = $this->getInput();
        $trackingId = trim($input['tracking_id'] ?? '');

        if (empty($trackingId) || !preg_match('/^[a-zA-Z0-9._\-]{1,128}$/', $trackingId)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid tracking ID']);
            exit();
        }

        try {
            $db = Database::getInstance();

            // Находим загрузку
            $stmt = $db->query(
                "SELECT file_path, media_type FROM temp_uploads WHERE user_id = ? AND tracking_id = ?",
                [$authUser['userId'], $trackingId]
            );
            $uploads = $stmt->fetchAll();

            if (empty($uploads)) {
                $this->sendResponse(['ok' => true, 'deleted' => 0]);
                return;
            }

            $deleted = 0;

            foreach ($uploads as $upload) {
                $path = $upload['file_path'];
                $mediaType = $upload['media_type'];

                // Используем универсальную функцию удаления
                if ($this->deleteMediaFile($path, $mediaType)) {
                    $deleted++;
                }
            }

            // Удаляем все записи из БД одним запросом (вне цикла)
            $db->query("DELETE FROM temp_uploads WHERE user_id = ? AND tracking_id = ?", [$authUser['userId'], $trackingId]);

            $this->sendResponse(['ok' => true, 'deleted' => $deleted]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to cancel upload: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /upload/media — удаление загруженного медиафайла с сервера
     * Для HLS-видео удаляет всю директорию {uuid}/
     */
    public function deleteUploadedMedia() {
        AuthMiddleware::requireAuth();

        $input = $this->getInput();
        $url   = trim($input['url'] ?? '');

        if (!preg_match('#^/uploads/(videos|posts|gifs)/#', $url)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid URL']);
            exit();
        }

        $base = realpath(__DIR__ . '/../../');

        // HLS-видео: /uploads/videos/{uuid}/master.m3u8 → удалить директорию uuid/
        if (preg_match('#^/uploads/videos/([a-f0-9]+)/master\.m3u8$#', $url, $m)) {
            $dir = $base . '/uploads/videos/' . $m[1];
            if (is_dir($dir)) $this->deleteDirectory($dir);
            // Удаляем запись из temp_uploads
            try {
                $db = Database::getInstance();
                $db->query("DELETE FROM temp_uploads WHERE file_path = ?", [$m[1]]);
            } catch (Exception $e) {
                error_log("Failed to delete video from temp_uploads: " . $e->getMessage());
            }
            $this->sendResponse(['ok' => true]);
        }

        // Одиночный файл (картинки, GIF)
        $filePath = $base . $url;
        if (file_exists($filePath)) {
            unlink($filePath);
            if (strpos($url, '/uploads/posts/') === 0) {
                $thumb = $base . '/uploads/posts/thumbs/' . basename($url);
                if (file_exists($thumb)) unlink($thumb);
            }
        }

        // Удаляем запись из temp_uploads
        try {
            $db = Database::getInstance();
            $db->query("DELETE FROM temp_uploads WHERE file_path = ?", [$url]);
        } catch (Exception $e) {
            error_log("Failed to delete media from temp_uploads: " . $e->getMessage());
        }

        $this->sendResponse(['ok' => true]);
    }

    /**
     * Рекурсивное удаление директории
     */
    private function deleteDirectory($dir) {
        if (!is_dir($dir)) return;
        foreach (array_diff(scandir($dir), ['.', '..']) as $item) {
            $path = $dir . '/' . $item;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    /**
     * Универсальное удаление медиафайлов
     * @param string $path Путь к файлу (UUID для видео, полный путь для остальных)
     * @param string $mediaType Тип медиа: 'video', 'image', 'gif'
     * @return bool Успешно ли удалён файл
     */
    private function deleteMediaFile($path, $mediaType) {
        $base = realpath(__DIR__ . '/../../');

        switch ($mediaType) {
            case 'video':
                // Для видео path это UUID
                exec("pkill -f 'ffmpeg.*{$path}' 2>&1");
                $dir = $base . '/uploads/videos/' . $path;
                if (is_dir($dir)) {
                    $this->deleteDirectory($dir);
                    return true;
                }
                break;

            case 'image':
            case 'gif':
                // Для картинок/гифок path это полный путь типа /uploads/posts/...
                $filePath = $base . $path;
                if (file_exists($filePath)) {
                    unlink($filePath);
                    // Удалить thumbnail если есть
                    if (strpos($path, '/uploads/posts/') === 0) {
                        $thumb = $base . '/uploads/posts/thumbs/' . basename($path);
                        if (file_exists($thumb)) unlink($thumb);
                    }
                    return true;
                }
                break;
        }

        return false;
    }

    /**
     * POST /upload/post-video — загрузка видео с HLS-транскодингом (360p/720p/1080p)
     */
    public function uploadPostVideo() {
        set_time_limit(600); // 10 минут максимум на конвертацию

        $authUser = AuthMiddleware::requireAuth();

        // Rate limiting: не более 2 одновременных конвертаций на пользователя
        try {
            $db = Database::getInstance();
            $stmt = $db->query(
                "SELECT COUNT(*) as cnt FROM temp_uploads WHERE user_id = ? AND media_type = 'video' AND created_at > NOW() - INTERVAL '10 minutes'",
                [$authUser['userId']]
            );
            $active = $stmt->fetch();
            if ((int)($active['cnt'] ?? 0) >= 2) {
                http_response_code(429);
                echo json_encode(['error' => 'Too many concurrent video uploads. Please wait.']);
                exit();
            }
        } catch (Exception $e) {
            error_log("Failed to check video rate limit: " . $e->getMessage());
        }

        if (!isset($_FILES['video']) || empty($_FILES['video']['name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'No video uploaded']);
            exit();
        }

        $file = $_FILES['video'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'Error uploading video']);
            exit();
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $allowedMimes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'];
        if (!in_array($mimeType, $allowedMimes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type. Allowed: MP4, MOV, WebM, AVI']);
            exit();
        }

        $maxSize = 100 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large (max 100MB)']);
            exit();
        }

        $ext             = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExts     = ['mp4', 'mov', 'webm', 'avi', 'mpeg', 'mpg'];
        if (!in_array($ext, $allowedExts)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file extension']);
            exit();
        }

        // Уникальная директория для HLS-сегментов этого видео
        $uuid     = bin2hex(random_bytes(12));
        $videoDir = __DIR__ . '/../../uploads/videos/' . $uuid . '/';
        mkdir($videoDir, 0755, true);

        $originalPath = $videoDir . 'original.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $originalPath)) {
            rmdir($videoDir);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save video']);
            exit();
        }

        $url = '/uploads/videos/' . $uuid . '/master.m3u8';

        // Получаем tracking_id из заголовка и регистрируем СРАЗУ после сохранения файла
        // Сохраняем только UUID для простого удаления всей папки
        $trackingId = $_SERVER['HTTP_X_TRACKING_ID'] ?? null;
        try {
            $db = Database::getInstance();
            $db->query(
                "INSERT INTO temp_uploads (user_id, file_path, media_type, tracking_id) VALUES (?, ?, ?, ?)",
                [$authUser['userId'], $uuid, 'video', $trackingId]
            );
        } catch (Exception $e) {
            error_log("Failed to register video upload in temp_uploads: " . $e->getMessage());
        }

        // Определяем размеры оригинала, чтобы не апскейлить
        $info           = $this->getVideoInfo($originalPath);
        $originalHeight = $info['height'];
        $hasAudio       = $info['has_audio'];

        // Уровни качества: генерируем только те, что <= оригинала
        $qualityLevels = [
            360  => ['bitrate' => '400k',  'audioBitrate' => '96k',  'bandwidth' => 496000,  'resolution' => '640x360'],
            720  => ['bitrate' => '2000k', 'audioBitrate' => '128k', 'bandwidth' => 2128000, 'resolution' => '1280x720'],
            1080 => ['bitrate' => '4500k', 'audioBitrate' => '192k', 'bandwidth' => 4692000, 'resolution' => '1920x1080'],
        ];

        $levelsToGenerate = array_filter($qualityLevels, fn($h) => $h <= $originalHeight + 60, ARRAY_FILTER_USE_KEY);
        if (empty($levelsToGenerate)) {
            $levelsToGenerate = [360 => $qualityLevels[360]];
        }

        // Запускаем все конвертации параллельно
        $processes = $this->startParallelTranscode($originalPath, $videoDir, $levelsToGenerate, $hasAudio);
        $generated = $this->waitForTranscode($processes, $levelsToGenerate, $videoDir);

        // Fallback: если параллельная не сработала, пробуем 360p последовательно
        if (empty($generated)) {
            $ok = $this->transcodeToHLS($originalPath, $videoDir, 360, $qualityLevels[360], $hasAudio);
            if ($ok) $generated[360] = $qualityLevels[360];
        }

        if (empty($generated)) {
            http_response_code(500);
            echo json_encode(['error' => 'Video transcoding failed']);
            exit();
        }

        $this->generateMasterPlaylist($videoDir . 'master.m3u8', $generated);

        $this->sendResponse([
            'url'      => $url,
            'filename' => $file['name'],
        ], 201);
    }

    /**
     * Получить размеры видео и наличие аудиодорожки через ffprobe
     */
    private function getVideoInfo($filePath) {
        $ffprobe = $this->config['ffmpeg']['ffprobe'] ?? 'ffprobe';
        $default = ['width' => 1920, 'height' => 1080, 'has_audio' => true];

        exec('which ffprobe', $out, $code);
        if ($code !== 0) return $default;

        $cmd = sprintf(
            '%s -v quiet -print_format json -show_streams %s 2>&1',
            escapeshellarg($ffprobe),
            escapeshellarg($filePath)
        );
        $out = []; // Очищаем массив перед вторым exec
        exec($cmd, $out);
        $data = json_decode(implode('', $out), true);

        $result = ['width' => 1920, 'height' => 1080, 'has_audio' => false];
        foreach ($data['streams'] ?? [] as $stream) {
            if ($stream['codec_type'] === 'video') {
                $result['width']  = (int)($stream['width']  ?? 1920);
                $result['height'] = (int)($stream['height'] ?? 1080);
            }
            if ($stream['codec_type'] === 'audio') {
                $result['has_audio'] = true;
            }
        }
        return $result;
    }

    private function buildFFmpegArgs($inputPath, $height, $params, $hasAudio, $outDir) {
        $ffmpeg = $this->config['ffmpeg']['binary'] ?? 'ffmpeg';
        $bitrateNum = (int)$params['bitrate'];
        $bufsize    = ($bitrateNum * 2) . 'k';
        $audioArgs  = $hasAudio
            ? ['-c:a', 'aac', '-b:a', $params['audioBitrate'], '-ar', '44100', '-ac', '2']
            : ['-an'];

        return array_merge(
            [
                $ffmpeg, '-i', $inputPath,
                '-vf', "scale=-2:{$height}",
                '-c:v', 'libx264', '-b:v', $params['bitrate'],
                '-maxrate', $params['bitrate'], '-bufsize', $bufsize,
                '-preset', 'fast', '-profile:v', 'baseline', '-level', '3.1',
                '-pix_fmt', 'yuv420p',
            ],
            $audioArgs,
            [
                '-hls_time', '6', '-hls_playlist_type', 'vod',
                '-hls_segment_filename', $outDir . 'seg%03d.ts',
                $outDir . 'stream.m3u8', '-y',
            ]
        );
    }

    private function transcodeToHLS($inputPath, $videoDir, $height, $params, $hasAudio) {
        $outDir = $videoDir . $height . 'p/';
        if (!is_dir($outDir)) mkdir($outDir, 0755, true);

        $args        = $this->buildFFmpegArgs($inputPath, $height, $params, $hasAudio, $outDir);
        $descriptors = [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']];
        $process     = proc_open($args, $descriptors, $pipes);

        if (!is_resource($process)) {
            error_log("proc_open failed for HLS {$height}p");
            return false;
        }

        fclose($pipes[0]);
        $stderr     = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $returnCode = proc_close($process);

        if ($returnCode !== 0) {
            error_log("HLS transcode {$height}p failed: " . $stderr);
            return false;
        }
        return file_exists($outDir . 'stream.m3u8');
    }

    private function startParallelTranscode($inputPath, $videoDir, $levels, $hasAudio) {
        $processes = [];
        foreach ($levels as $height => $params) {
            $outDir = $videoDir . $height . 'p/';
            if (!is_dir($outDir)) mkdir($outDir, 0755, true);

            $args        = $this->buildFFmpegArgs($inputPath, $height, $params, $hasAudio, $outDir);
            $descriptors = [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']];
            $process     = proc_open($args, $descriptors, $pipes);

            if (is_resource($process)) {
                fclose($pipes[0]);
                $processes[$height] = ['proc' => $process, 'pipes' => $pipes];
            } else {
                error_log("proc_open failed for HLS {$height}p");
            }
        }
        return $processes;
    }

    private function waitForTranscode($processes, $levels, $videoDir) {
        $generated = [];
        $timeout   = 580; // чуть меньше set_time_limit
        $start     = time();

        while (!empty($processes)) {
            if (time() - $start > $timeout) {
                // Убиваем зависшие процессы
                foreach ($processes as $height => $entry) {
                    proc_terminate($entry['proc']);
                    fclose($entry['pipes'][1]);
                    fclose($entry['pipes'][2]);
                    proc_close($entry['proc']);
                    error_log("HLS transcode {$height}p killed by timeout");
                }
                break;
            }

            // Собираем stderr-потоки для stream_select
            $read = array_column(array_values($processes), 'pipes');
            $read = array_map(fn($p) => $p[2], $read);
            $write = $except = null;

            if (!stream_select($read, $write, $except, 0, 200000)) {
                continue; // 200ms пауза, потом проверяем снова
            }

            foreach ($processes as $height => $entry) {
                $status = proc_get_status($entry['proc']);
                if (!$status['running']) {
                    // exit code берём из proc_get_status, т.к. proc_close вернёт -1 после него
                    $code = $status['exitcode'];

                    $stdout = stream_get_contents($entry['pipes'][1]);
                    $stderr = stream_get_contents($entry['pipes'][2]);
                    fclose($entry['pipes'][1]);
                    fclose($entry['pipes'][2]);
                    proc_close($entry['proc']);
                    unset($processes[$height]);

                    $streamPath = $videoDir . $height . 'p/stream.m3u8';
                    $exists = file_exists($streamPath);

                    if ($code === 0 && $exists) {
                        $generated[$height] = $levels[$height];
                    } else {
                        error_log("HLS transcode {$height}p failed (exit code {$code})");
                    }
                }
            }
        }

        return $generated;
    }

    /**
     * Генерировать master.m3u8 из сгенерированных уровней качества
     */
    private function generateMasterPlaylist($masterPath, $levels) {
        $content = "#EXTM3U\n#EXT-X-VERSION:3\n";
        ksort($levels); // порядок от низкого к высокому
        foreach ($levels as $height => $params) {
            $content .= "#EXT-X-STREAM-INF:BANDWIDTH={$params['bandwidth']}"
                      . ",RESOLUTION={$params['resolution']}"
                      . ",CODECS=\"avc1.42e01e,mp4a.40.2\"\n";
            $content .= "{$height}p/stream.m3u8\n";
        }
        file_put_contents($masterPath, $content);
    }

    /**
     */
    private function convertGifToMp4($gifPath, $mp4Path) {
        $ffmpegPath = $this->config['ffmpeg']['binary'] ?? 'ffmpeg';

        exec('which ffmpeg', $out, $code);
        if ($code !== 0) {
            error_log("FFmpeg not found in PATH");
            return false;
        }

        // Проверить, что пути находятся в /uploads/gifs/
        $uploadsDir = realpath(__DIR__ . '/../../uploads/gifs/');
        $gifRealPath = realpath($gifPath);
        $mp4RealPath = dirname(realpath(dirname($mp4Path))) . '/' . basename(dirname($mp4Path)) . '/' . basename($mp4Path);

        if (!$gifRealPath || strpos($gifRealPath, $uploadsDir) !== 0) {
            error_log("Invalid GIF path: $gifPath");
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

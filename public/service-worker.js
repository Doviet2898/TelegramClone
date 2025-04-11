// Service Worker cho Telegram Clone

// Cache version
const CACHE_VERSION = 'v1';
const CACHE_NAME = `telegram-clone-${CACHE_VERSION}`;

// Tài nguyên cần cache
const CACHE_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/app-extended.js',
    '/styles.css',
    '/default-avatar.png'
];

// Cài đặt Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Kích hoạt Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('telegram-clone-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
});

// Xử lý fetch requests
self.addEventListener('fetch', (event) => {
    // Bỏ qua các request không phải GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Trả về response từ cache nếu có
                if (response) return response;

                // Clone request vì nó chỉ có thể sử dụng một lần
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then((response) => {
                    // Kiểm tra response có hợp lệ không
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone response vì nó chỉ có thể sử dụng một lần
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// Xử lý push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: data.icon || '/default-avatar.png',
        badge: '/notification-badge.png',
        data: data.data,
        actions: data.actions || [],
        tag: data.tag || 'default',
        renotify: true,
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Xử lý click vào notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    if (data && data.url) {
        event.waitUntil(
            clients.matchAll({ type: 'window' })
                .then((clientList) => {
                    // Nếu đã có cửa sổ mở, focus vào nó
                    for (const client of clientList) {
                        if (client.url === data.url && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Nếu không có cửa sổ nào mở, mở cửa sổ mới
                    if (clients.openWindow) {
                        return clients.openWindow(data.url);
                    }
                })
        );
    }
});

// Xử lý sync background
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        event.waitUntil(
            syncMessages()
        );
    }
});

// Hàm đồng bộ tin nhắn
async function syncMessages() {
    try {
        const db = await openDB();
        const unsentMessages = await db.getAll('unsent_messages');

        for (const message of unsentMessages) {
            try {
                const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${message.token}`
                    },
                    body: JSON.stringify(message.data)
                });

                if (response.ok) {
                    await db.delete('unsent_messages', message.id);
                }
            } catch (error) {
                console.error('Lỗi khi đồng bộ tin nhắn:', error);
            }
        }
    } catch (error) {
        console.error('Lỗi khi mở IndexedDB:', error);
    }
}

// Hàm mở IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TelegramCloneDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('unsent_messages')) {
                db.createObjectStore('unsent_messages', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}
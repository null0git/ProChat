// ProChat - Real-time Chat JavaScript
class ChatApp {
    constructor() {
        this.socket = null;
        this.currentRoom = null;
        this.currentUser = null;
        this.isTyping = false;
        this.typingTimeout = null;
        this.messageContainer = null;
        this.messageInput = null;
        this.messageForm = null;
        
        this.init();
    }
    
    init() {
        this.setupSocketConnection();
        this.setupEventListeners();
        this.setupUI();
        this.loadCurrentUser();
    }
    
    setupSocketConnection() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            this.setupSocketEvents();
        }
    }
    
    setupSocketEvents() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });
        
        // Message events
        this.socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });
        
        this.socket.on('user_typing', (data) => {
            this.handleTypingIndicator(data);
        });
        
        this.socket.on('message_read', (data) => {
            this.handleMessageRead(data);
        });
        
        this.socket.on('status_update', (data) => {
            this.handleUserStatusUpdate(data);
        });
        
        this.socket.on('online_users', (data) => {
            this.updateOnlineUsers(data.users);
        });
        
        // Error handling
        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.showNotification('Connection error: ' + data.message, 'error');
        });
    }
    
    setupEventListeners() {
        // Message form submission
        this.messageForm = document.getElementById('messageForm');
        if (this.messageForm) {
            this.messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }
        
        // Message input events
        this.messageInput = document.getElementById('messageInput');
        if (this.messageInput) {
            this.messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
            
            this.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // Attachment handling
        const attachmentBtn = document.getElementById('sendAttachment');
        if (attachmentBtn) {
            attachmentBtn.addEventListener('click', () => {
                this.sendAttachment();
            });
        }
        
        // Search functionality
        const searchInput = document.getElementById('searchConversations');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterConversations(e.target.value);
            });
        }
        
        // Conversation clicks
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const userId = e.currentTarget.dataset.userId;
                const groupId = e.currentTarget.dataset.groupId;
                
                if (userId) {
                    this.openDirectChat(userId);
                } else if (groupId) {
                    this.openGroupChat(groupId);
                }
            });
        });
        
        // Window visibility for read receipts
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.markVisibleMessagesAsRead();
            }
        });
    }
    
    setupUI() {
        this.messageContainer = document.getElementById('chatMessages');
        
        // Scroll to bottom of messages
        if (this.messageContainer) {
            this.scrollToBottom();
        }
        
        // Setup message observer for read receipts
        this.setupMessageObserver();
    }
    
    loadCurrentUser() {
        // Get current user info from the page
        const userElement = document.querySelector('[data-current-user]');
        if (userElement) {
            this.currentUser = JSON.parse(userElement.dataset.currentUser);
        }
    }
    
    sendMessage() {
        if (!this.messageInput || !this.socket) return;
        
        const content = this.messageInput.value.trim();
        if (!content) return;
        
        const messageData = {
            content: content,
            message_type: 'text'
        };
        
        // Determine recipient
        const chatContainer = document.querySelector('[data-chat-type]');
        if (chatContainer) {
            const chatType = chatContainer.dataset.chatType;
            const chatId = chatContainer.dataset.chatId;
            
            if (chatType === 'direct') {
                messageData.recipient_id = chatId;
                messageData.room = this.getDirectChatRoom(this.currentUser.id, chatId);
            } else if (chatType === 'group') {
                messageData.group_id = chatId;
                messageData.room = `group_${chatId}`;
            }
        }
        
        // Send via socket
        this.socket.emit('send_message', messageData);
        
        // Clear input
        this.messageInput.value = '';
        this.stopTyping();
    }
    
    sendAttachment() {
        const fileInput = document.getElementById('attachmentFile');
        const captionInput = document.getElementById('attachmentCaption');
        
        if (!fileInput.files[0]) {
            this.showNotification('Please select a file', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('caption', captionInput.value || '');
        
        // Determine recipient
        const chatContainer = document.querySelector('[data-chat-type]');
        if (chatContainer) {
            const chatType = chatContainer.dataset.chatType;
            const chatId = chatContainer.dataset.chatId;
            
            if (chatType === 'direct') {
                formData.append('recipient_id', chatId);
            } else if (chatType === 'group') {
                formData.append('group_id', chatId);
            }
        }
        
        // Show upload progress
        this.showLoading();
        
        fetch('/api/send_attachment', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            this.hideLoading();
            if (data.status === 'success') {
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('attachmentModal'));
                modal.hide();
                
                // Clear form
                fileInput.value = '';
                captionInput.value = '';
            } else {
                this.showNotification('Failed to send attachment', 'error');
            }
        })
        .catch(error => {
            this.hideLoading();
            console.error('Error sending attachment:', error);
            this.showNotification('Error sending attachment', 'error');
        });
    }
    
    handleNewMessage(data) {
        this.addMessageToChat(data);
        this.updateConversationPreview(data);
        this.playNotificationSound();
        
        // Show notification if window is not active
        if (document.hidden) {
            this.showDesktopNotification(data);
        }
        
        // Mark as read if visible
        if (!document.hidden) {
            this.markMessageAsRead(data.message_id);
        }
    }
    
    addMessageToChat(messageData) {
        if (!this.messageContainer) return;
        
        const messageElement = this.createMessageElement(messageData);
        this.messageContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // Animate message appearance
        requestAnimationFrame(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });
    }
    
    createMessageElement(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.sender_id === this.currentUser.id ? 'outgoing' : 'incoming'}`;
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
        messageDiv.style.transition = 'all 0.3s ease';
        messageDiv.dataset.messageId = data.message_id;
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${this.formatMessageContent(data)}
            </div>
            <div class="message-meta">
                <small class="text-muted">
                    ${timestamp}
                    ${data.sender_id === this.currentUser.id ? '<i class="fas fa-check text-muted ms-1"></i>' : ''}
                </small>
            </div>
        `;
        
        return messageDiv;
    }
    
    formatMessageContent(data) {
        switch (data.message_type) {
            case 'image':
                return `
                    <img src="${data.file_url}" alt="Image" class="message-image">
                    ${data.content ? `<p class="mt-2">${this.escapeHtml(data.content)}</p>` : ''}
                `;
            case 'document':
                return `
                    <div class="message-document">
                        <i class="fas fa-file me-2"></i>
                        <a href="${data.file_url}" download>${data.file_name}</a>
                    </div>
                    ${data.content ? `<p class="mt-2">${this.escapeHtml(data.content)}</p>` : ''}
                `;
            default:
                return this.escapeHtml(data.content);
        }
    }
    
    handleTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (!typingIndicator) return;
        
        const typingText = typingIndicator.querySelector('.typing-text');
        
        if (data.is_typing && data.user_id !== this.currentUser.id) {
            typingText.textContent = `${data.user_name} is typing...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }
    
    handleTyping() {
        if (!this.socket || !this.currentRoom) return;
        
        if (!this.isTyping) {
            this.isTyping = true;
            this.socket.emit('typing', {
                room: this.currentRoom,
                is_typing: true
            });
        }
        
        // Clear existing timeout
        clearTimeout(this.typingTimeout);
        
        // Set new timeout
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 1000);
    }
    
    stopTyping() {
        if (this.isTyping && this.socket && this.currentRoom) {
            this.isTyping = false;
            this.socket.emit('typing', {
                room: this.currentRoom,
                is_typing: false
            });
        }
        
        clearTimeout(this.typingTimeout);
    }
    
    handleMessageRead(data) {
        const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
        if (messageElement) {
            const checkIcon = messageElement.querySelector('.fa-check');
            if (checkIcon) {
                checkIcon.className = 'fas fa-check-double text-primary ms-1';
            }
        }
    }
    
    markMessageAsRead(messageId) {
        if (!this.socket) return;
        
        this.socket.emit('mark_read', {
            message_id: messageId
        });
    }
    
    markVisibleMessagesAsRead() {
        if (!this.messageContainer) return;
        
        const messages = this.messageContainer.querySelectorAll('.message.incoming[data-message-id]');
        messages.forEach(message => {
            if (this.isElementInViewport(message)) {
                const messageId = message.dataset.messageId;
                this.markMessageAsRead(messageId);
            }
        });
    }
    
    setupMessageObserver() {
        if (!this.messageContainer) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageElement = entry.target;
                    if (messageElement.classList.contains('incoming')) {
                        const messageId = messageElement.dataset.messageId;
                        if (messageId) {
                            this.markMessageAsRead(messageId);
                        }
                    }
                }
            });
        }, {
            threshold: 0.5
        });
        
        // Observe existing messages
        this.messageContainer.querySelectorAll('.message[data-message-id]').forEach(message => {
            observer.observe(message);
        });
        
        // Observe new messages
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList?.contains('message')) {
                        observer.observe(node);
                    }
                });
            });
        });
        
        mutationObserver.observe(this.messageContainer, { childList: true });
    }
    
    openDirectChat(userId) {
        if (this.currentRoom) {
            this.socket.emit('leave_room', { room: this.currentRoom });
        }
        
        this.currentRoom = this.getDirectChatRoom(this.currentUser.id, userId);
        this.socket.emit('join_room', {
            room: this.currentRoom,
            type: 'direct'
        });
        
        // Navigate to chat
        window.location.href = `/chat/${userId}`;
    }
    
    openGroupChat(groupId) {
        if (this.currentRoom) {
            this.socket.emit('leave_room', { room: this.currentRoom });
        }
        
        this.currentRoom = `group_${groupId}`;
        this.socket.emit('join_room', {
            room: this.currentRoom,
            type: 'group'
        });
        
        // Navigate to group
        window.location.href = `/groups/${groupId}`;
    }
    
    getDirectChatRoom(userId1, userId2) {
        const sortedIds = [userId1, userId2].sort();
        return `user_${sortedIds[0]}_${sortedIds[1]}`;
    }
    
    handleUserStatusUpdate(data) {
        // Update user status indicators
        const statusElements = document.querySelectorAll(`[data-user-id="${data.user_id}"] .online-indicator`);
        statusElements.forEach(element => {
            if (data.status === 'online') {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });
        
        // Update last seen text
        const lastSeenElements = document.querySelectorAll(`[data-user-id="${data.user_id}"] .last-seen-text`);
        lastSeenElements.forEach(element => {
            if (data.status === 'online') {
                element.textContent = 'Online';
            } else if (data.last_seen) {
                const lastSeen = new Date(data.last_seen);
                element.textContent = `Last seen ${this.formatRelativeTime(lastSeen)}`;
            }
        });
    }
    
    updateOnlineUsers(users) {
        // Update online users list if it exists
        const onlineUsersList = document.getElementById('onlineUsersList');
        if (onlineUsersList) {
            onlineUsersList.innerHTML = users.map(user => `
                <div class="online-user-item">
                    <img src="${user.image || '/static/images/default-avatar.png'}" 
                         alt="${user.name}" class="rounded-circle me-2" width="24" height="24">
                    <span>${user.name}</span>
                </div>
            `).join('');
        }
    }
    
    updateConversationPreview(messageData) {
        const conversationItem = document.querySelector(`[data-user-id="${messageData.sender_id}"]`);
        if (conversationItem) {
            const previewElement = conversationItem.querySelector('.conversation-preview');
            if (previewElement) {
                previewElement.textContent = messageData.content.substring(0, 30) + '...';
            }
            
            // Move to top of conversations list
            const conversationsList = conversationItem.parentElement;
            conversationsList.insertBefore(conversationItem, conversationsList.firstChild);
        }
    }
    
    filterConversations(query) {
        const conversationItems = document.querySelectorAll('.conversation-item');
        const searchQuery = query.toLowerCase();
        
        conversationItems.forEach(item => {
            const name = item.querySelector('.conversation-name').textContent.toLowerCase();
            const preview = item.querySelector('.conversation-preview').textContent.toLowerCase();
            
            if (name.includes(searchQuery) || preview.includes(searchQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    updateConnectionStatus(isConnected) {
        const statusIndicator = document.getElementById('connectionStatus');
        if (statusIndicator) {
            statusIndicator.className = isConnected ? 
                'badge bg-success' : 'badge bg-danger';
            statusIndicator.textContent = isConnected ? 'Connected' : 'Disconnected';
        }
    }
    
    playNotificationSound() {
        // Only play if user has enabled sound notifications
        if (this.shouldPlaySound()) {
            const audio = new Audio('/static/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(e => {
                // Handle autoplay restrictions
                console.log('Could not play notification sound:', e);
            });
        }
    }
    
    shouldPlaySound() {
        // Check if notifications are enabled and window is not focused
        return !document.hidden || localStorage.getItem('soundNotifications') === 'true';
    }
    
    showDesktopNotification(messageData) {
        if (Notification.permission === 'granted') {
            const notification = new Notification(`New message from ${messageData.sender_name}`, {
                body: messageData.content,
                icon: messageData.sender_image || '/static/images/default-avatar.png',
                tag: `message_${messageData.message_id}`
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        }
    }
    
    showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
    
    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }
    
    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }
    
    isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for template usage
window.openDirectChat = function(userId) {
    if (window.chatApp) {
        window.chatApp.openDirectChat(userId);
    } else {
        window.location.href = `/chat/${userId}`;
    }
};

window.openGroupChat = function(groupId) {
    if (window.chatApp) {
        window.chatApp.openGroupChat(groupId);
    } else {
        window.location.href = `/groups/${groupId}`;
    }
};

// Initialize chat app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on chat pages
    if (document.querySelector('.chat-main') || document.querySelector('.sidebar-chat')) {
        window.chatApp = new ChatApp();
    }
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Service worker registration for PWA features
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('Service worker registration failed:', error);
        });
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.chatApp) {
        if (document.hidden) {
            // User switched away from tab
            console.log('User left the tab');
        } else {
            // User returned to tab
            console.log('User returned to tab');
            if (window.chatApp.markVisibleMessagesAsRead) {
                window.chatApp.markVisibleMessagesAsRead();
            }
        }
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.chatApp) {
        window.chatApp.showNotification('Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.chatApp) {
        window.chatApp.showNotification('You are offline', 'warning');
    }
});

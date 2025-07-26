// ProChat - Stories JavaScript Module
class StoriesManager {
    constructor() {
        this.currentStoryIndex = 0;
        this.stories = [];
        this.storyViewer = null;
        this.progressBars = [];
        this.autoPlayTimer = null;
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadStories();
        this.setupStoryViewer();
    }
    
    setupEventListeners() {
        // Story item clicks
        document.querySelectorAll('.story-item, .story-card').forEach(item => {
            item.addEventListener('click', (e) => {
                const storyId = e.currentTarget.dataset.storyId || 
                               e.currentTarget.getAttribute('onclick')?.match(/\d+/)?.[0];
                if (storyId) {
                    this.openStory(parseInt(storyId));
                }
            });
        });
        
        // Story creation form
        const storyForm = document.querySelector('form[action*="create_story"]');
        if (storyForm) {
            this.setupStoryCreation(storyForm);
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.storyViewer && this.storyViewer.style.display !== 'none') {
                this.handleKeyboardNavigation(e);
            }
        });
        
        // Touch/swipe navigation
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });
    }
    
    setupStoryViewer() {
        // Create story viewer if it doesn't exist
        if (!document.querySelector('.story-viewer')) {
            this.createStoryViewer();
        }
        
        this.storyViewer = document.querySelector('.story-viewer');
        
        if (this.storyViewer) {
            // Close button
            const closeBtn = this.storyViewer.querySelector('.story-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeStoryViewer();
                });
            }
            
            // Previous/Next navigation
            const prevBtn = this.storyViewer.querySelector('.story-prev');
            const nextBtn = this.storyViewer.querySelector('.story-next');
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    this.previousStory();
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    this.nextStory();
                });
            }
            
            // Click areas for navigation
            const leftArea = this.storyViewer.querySelector('.story-nav-left');
            const rightArea = this.storyViewer.querySelector('.story-nav-right');
            
            if (leftArea) {
                leftArea.addEventListener('click', () => {
                    this.previousStory();
                });
            }
            
            if (rightArea) {
                rightArea.addEventListener('click', () => {
                    this.nextStory();
                });
            }
            
            // Pause on mouse enter, resume on leave
            this.storyViewer.addEventListener('mouseenter', () => {
                this.pauseAutoPlay();
            });
            
            this.storyViewer.addEventListener('mouseleave', () => {
                this.resumeAutoPlay();
            });
        }
    }
    
    createStoryViewer() {
        const viewer = document.createElement('div');
        viewer.className = 'story-viewer';
        viewer.style.display = 'none';
        
        viewer.innerHTML = `
            <div class="story-header">
                <div class="story-progress">
                    <div class="progress-bars"></div>
                </div>
                <div class="story-user-info">
                    <div class="story-user-avatar">
                        <img src="" alt="" class="rounded-circle">
                    </div>
                    <div class="story-user-details">
                        <h6 class="story-user-name mb-0 text-white"></h6>
                        <small class="story-timestamp text-light"></small>
                    </div>
                </div>
                <div class="story-actions">
                    <button class="btn btn-outline-light btn-sm story-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="story-content">
                <div class="story-nav-left"></div>
                <div class="story-media-container">
                    <div class="story-media"></div>
                    <div class="story-caption"></div>
                </div>
                <div class="story-nav-right"></div>
            </div>
            
            <div class="story-footer">
                <div class="story-stats">
                    <small class="text-light story-view-count">
                        <i class="fas fa-eye me-1"></i><span>0</span> views
                    </small>
                </div>
                <div class="story-navigation">
                    <button class="btn btn-outline-light btn-sm story-prev">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="btn btn-outline-light btn-sm story-next">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(viewer);
        
        // Add CSS styles
        this.addStoryViewerStyles();
    }
    
    addStoryViewerStyles() {
        const styles = `
            .story-viewer {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #000;
                z-index: 9999;
                display: flex;
                flex-direction: column;
            }
            
            .story-progress {
                padding: 1rem;
                background: rgba(0, 0, 0, 0.3);
            }
            
            .progress-bars {
                display: flex;
                gap: 2px;
                height: 3px;
            }
            
            .progress-bar {
                flex: 1;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 2px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: white;
                width: 0;
                transition: width 0.1s ease;
            }
            
            .story-header {
                position: relative;
                z-index: 10;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .story-user-info {
                display: flex;
                align-items: center;
                padding: 0 1rem 1rem;
            }
            
            .story-user-avatar {
                width: 40px;
                height: 40px;
                margin-right: 1rem;
            }
            
            .story-user-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .story-content {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            
            .story-nav-left,
            .story-nav-right {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 30%;
                z-index: 5;
                cursor: pointer;
            }
            
            .story-nav-left {
                left: 0;
            }
            
            .story-nav-right {
                right: 0;
            }
            
            .story-media-container {
                max-width: 100%;
                max-height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            .story-media img,
            .story-media video {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 0.5rem;
            }
            
            .story-caption {
                position: absolute;
                bottom: 4rem;
                left: 2rem;
                right: 2rem;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 1rem;
                border-radius: 0.5rem;
                backdrop-filter: blur(10px);
            }
            
            .story-footer {
                padding: 1rem;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .story-navigation {
                display: flex;
                gap: 0.5rem;
            }
            
            @media (max-width: 768px) {
                .story-user-info {
                    padding: 0 1rem 0.5rem;
                }
                
                .story-caption {
                    left: 1rem;
                    right: 1rem;
                    bottom: 2rem;
                }
                
                .story-footer {
                    padding: 0.5rem 1rem;
                }
                
                .story-navigation {
                    display: none;
                }
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    loadStories() {
        // Get stories from the page
        this.stories = [];
        
        // Load from story items
        document.querySelectorAll('.story-item, .story-card').forEach(item => {
            const storyData = this.extractStoryData(item);
            if (storyData) {
                this.stories.push(storyData);
            }
        });
        
        // Load from API if needed
        this.loadStoriesFromAPI();
    }
    
    extractStoryData(element) {
        try {
            return {
                id: element.dataset.storyId || 
                    element.getAttribute('onclick')?.match(/\d+/)?.[0],
                authorName: element.querySelector('.story-author, .story-user-name')?.textContent || 'Unknown',
                authorAvatar: element.querySelector('img')?.src || '',
                timestamp: element.querySelector('.story-time, .story-timestamp')?.textContent || '',
                mediaUrl: element.querySelector('.story-preview img, .story-preview video')?.src || '',
                mediaType: element.querySelector('.story-preview video') ? 'video' : 'image',
                caption: element.dataset.caption || '',
                viewCount: element.querySelector('.story-stats')?.textContent?.match(/\d+/)?.[0] || 0
            };
        } catch (error) {
            console.error('Error extracting story data:', error);
            return null;
        }
    }
    
    loadStoriesFromAPI() {
        fetch('/api/stories')
            .then(response => response.json())
            .then(data => {
                if (data.stories) {
                    this.stories = data.stories;
                }
            })
            .catch(error => {
                console.error('Error loading stories:', error);
            });
    }
    
    openStory(storyId) {
        const storyIndex = this.stories.findIndex(story => 
            parseInt(story.id) === parseInt(storyId)
        );
        
        if (storyIndex !== -1) {
            this.currentStoryIndex = storyIndex;
            this.showStoryViewer();
            this.displayCurrentStory();
            this.recordStoryView(storyId);
        } else {
            // Fallback to direct URL
            window.location.href = `/stories/${storyId}/view`;
        }
    }
    
    showStoryViewer() {
        if (this.storyViewer) {
            this.storyViewer.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Create progress bars
            this.createProgressBars();
        }
    }
    
    closeStoryViewer() {
        if (this.storyViewer) {
            this.storyViewer.style.display = 'none';
            document.body.style.overflow = '';
            this.stopAutoPlay();
        }
    }
    
    createProgressBars() {
        const progressContainer = this.storyViewer.querySelector('.progress-bars');
        if (!progressContainer) return;
        
        progressContainer.innerHTML = '';
        this.progressBars = [];
        
        this.stories.forEach((story, index) => {
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            
            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);
            
            this.progressBars.push(progressFill);
        });
    }
    
    displayCurrentStory() {
        const story = this.stories[this.currentStoryIndex];
        if (!story || !this.storyViewer) return;
        
        // Update user info
        const userAvatar = this.storyViewer.querySelector('.story-user-avatar img');
        const userName = this.storyViewer.querySelector('.story-user-name');
        const timestamp = this.storyViewer.querySelector('.story-timestamp');
        const viewCount = this.storyViewer.querySelector('.story-view-count span');
        
        if (userAvatar) userAvatar.src = story.authorAvatar;
        if (userName) userName.textContent = story.authorName;
        if (timestamp) timestamp.textContent = story.timestamp;
        if (viewCount) viewCount.textContent = story.viewCount;
        
        // Update media
        const mediaContainer = this.storyViewer.querySelector('.story-media');
        const captionContainer = this.storyViewer.querySelector('.story-caption');
        
        if (mediaContainer) {
            if (story.mediaType === 'video') {
                mediaContainer.innerHTML = `
                    <video src="${story.mediaUrl}" controls autoplay muted>
                        Your browser does not support the video tag.
                    </video>
                `;
            } else if (story.mediaUrl) {
                mediaContainer.innerHTML = `
                    <img src="${story.mediaUrl}" alt="Story" loading="lazy">
                `;
            } else {
                mediaContainer.innerHTML = `
                    <div class="story-text-content">
                        <p>${story.caption}</p>
                    </div>
                `;
            }
        }
        
        // Update caption
        if (captionContainer) {
            if (story.caption && story.mediaUrl) {
                captionContainer.innerHTML = `<p>${story.caption}</p>`;
                captionContainer.style.display = 'block';
            } else {
                captionContainer.style.display = 'none';
            }
        }
        
        // Update progress bars
        this.updateProgressBars();
        
        // Start auto-play timer
        this.startAutoPlay();
    }
    
    updateProgressBars() {
        this.progressBars.forEach((bar, index) => {
            if (index < this.currentStoryIndex) {
                bar.style.width = '100%';
            } else if (index === this.currentStoryIndex) {
                bar.style.width = '0%';
            } else {
                bar.style.width = '0%';
            }
        });
    }
    
    startAutoPlay() {
        this.stopAutoPlay();
        
        const currentProgressBar = this.progressBars[this.currentStoryIndex];
        if (!currentProgressBar) return;
        
        const duration = 5000; // 5 seconds
        let progress = 0;
        const interval = 50; // Update every 50ms
        
        this.autoPlayTimer = setInterval(() => {
            progress += interval;
            const percentage = (progress / duration) * 100;
            
            currentProgressBar.style.width = `${percentage}%`;
            
            if (progress >= duration) {
                this.nextStory();
            }
        }, interval);
    }
    
    stopAutoPlay() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
    }
    
    pauseAutoPlay() {
        this.stopAutoPlay();
    }
    
    resumeAutoPlay() {
        this.startAutoPlay();
    }
    
    nextStory() {
        if (this.currentStoryIndex < this.stories.length - 1) {
            this.currentStoryIndex++;
            this.displayCurrentStory();
        } else {
            this.closeStoryViewer();
        }
    }
    
    previousStory() {
        if (this.currentStoryIndex > 0) {
            this.currentStoryIndex--;
            this.displayCurrentStory();
        }
    }
    
    handleKeyboardNavigation(e) {
        switch (e.key) {
            case 'Escape':
                this.closeStoryViewer();
                break;
            case 'ArrowLeft':
                this.previousStory();
                break;
            case 'ArrowRight':
            case ' ':
                e.preventDefault();
                this.nextStory();
                break;
        }
    }
    
    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next story
                this.nextStory();
            } else {
                // Swipe right - previous story
                this.previousStory();
            }
        }
    }
    
    setupStoryCreation(form) {
        const mediaInput = form.querySelector('input[type="file"]');
        const previewContainer = this.createPreviewContainer();
        
        if (mediaInput) {
            mediaInput.addEventListener('change', (e) => {
                this.handleFilePreview(e.target.files[0], previewContainer);
            });
        }
        
        // Add preview container after file input
        if (mediaInput && mediaInput.parentNode) {
            mediaInput.parentNode.insertBefore(previewContainer, mediaInput.nextSibling);
        }
    }
    
    createPreviewContainer() {
        const container = document.createElement('div');
        container.className = 'story-preview-container mt-3';
        container.style.display = 'none';
        
        container.innerHTML = `
            <div class="story-preview-media"></div>
            <button type="button" class="btn btn-sm btn-outline-danger mt-2 remove-preview">
                <i class="fas fa-times me-1"></i>Remove
            </button>
        `;
        
        const removeBtn = container.querySelector('.remove-preview');
        removeBtn.addEventListener('click', () => {
            container.style.display = 'none';
            const fileInput = container.previousElementSibling;
            if (fileInput && fileInput.type === 'file') {
                fileInput.value = '';
            }
        });
        
        return container;
    }
    
    handleFilePreview(file, container) {
        if (!file) {
            container.style.display = 'none';
            return;
        }
        
        const reader = new FileReader();
        const mediaContainer = container.querySelector('.story-preview-media');
        
        reader.onload = (e) => {
            const isVideo = file.type.startsWith('video/');
            
            if (isVideo) {
                mediaContainer.innerHTML = `
                    <video src="${e.target.result}" controls style="max-width: 200px; max-height: 200px; border-radius: 0.5rem;">
                        Your browser does not support video preview.
                    </video>
                `;
            } else {
                mediaContainer.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; object-fit: cover; border-radius: 0.5rem;">
                `;
            }
            
            container.style.display = 'block';
        };
        
        reader.readAsDataURL(file);
    }
    
    recordStoryView(storyId) {
        fetch(`/stories/${storyId}/view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }).catch(error => {
            console.error('Error recording story view:', error);
        });
    }
    
    refreshStories() {
        this.loadStoriesFromAPI();
        
        // Refresh story elements
        setTimeout(() => {
            this.setupEventListeners();
        }, 500);
    }
}

// Initialize stories manager
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.story-item, .story-card, .stories-section')) {
        window.storiesManager = new StoriesManager();
    }
});

// Global function for template usage
window.viewStory = function(storyId) {
    if (window.storiesManager) {
        window.storiesManager.openStory(storyId);
    } else {
        window.location.href = `/stories/${storyId}/view`;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StoriesManager;
}

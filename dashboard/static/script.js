document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const videoIdInput = document.getElementById('video-id-input');
    const commentList = document.getElementById('comment-list');
    const statTotal = document.getElementById('stat-total');
    const statToxic = document.getElementById('stat-toxic');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    
    // Advanced search controls
    const keywordSearch = document.getElementById('keyword-search');

    let allComments = [];
    let currentFilter = 'all'; // 'all', 'toxic', 'clean'
    let searchQuery = '';

    // Fetch comments from overall Video ID
    fetchBtn.addEventListener('click', async () => {
        const videoId = videoIdInput.value.trim();
        if (!videoId) {
            showToast('Vui lòng nhập Video ID!');
            return;
        }

        fetchBtn.disabled = true;
        fetchBtn.innerText = 'Đang quét...';
        commentList.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải AI và quét bình luận từ YouTube...</p></div>';

        try {
            const response = await fetch(`/api/comments?video_id=${videoId}`);
            const data = await response.json();

            if (data.comments) {
                allComments = data.comments;
                renderComments();
                updateStats();
                showToast(`Đã tìm thấy ${allComments.length} bình luận!`);
            } else {
                throw new Error(data.detail || 'Lỗi không xác định');
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi: ' + error.message);
            commentList.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${error.message}</p></div>`;
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.innerText = 'Quét Bình Luận';
        }
    });

    // Category filtering
    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderComments();
            });
        });
    }

    // Search filter
    if (keywordSearch) {
        keywordSearch.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderComments();
        });
    }

    // Bulk delete action
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', async () => {
            const visibleToxic = getVisibleComments().filter(c => c.is_toxic);
            if (visibleToxic.length === 0) return;

            if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${visibleToxic.length} bình luận toxic đang hiển thị?`)) {
                return;
            }

            bulkDeleteBtn.disabled = true;
            bulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';

            let successCount = 0;
            for (const comment of visibleToxic) {
                const result = await performModeration(comment.id, 'delete');
                if (result) successCount++;
            }

            showToast(`Đã xóa thành công ${successCount} bình luận toxic!`);
            bulkDeleteBtn.disabled = false;
            bulkDeleteBtn.innerHTML = '<i class="fas fa-biohazard"></i> Xóa tất cả Toxic';
            
            renderComments();
            updateStats();
        });
    }

    function getVisibleComments() {
        return allComments.filter(c => {
            // Category check
            if (currentFilter === 'toxic' && !c.is_toxic) return false;
            if (currentFilter === 'clean' && c.is_toxic) return false;
            
            // Search query check
            if (searchQuery && !c.text.toLowerCase().includes(searchQuery)) return false;
            
            return true;
        });
    }

    function renderComments() {
        commentList.innerHTML = '';
        const filtered = getVisibleComments();

        // Show/Hide bulk delete button
        const toxicInView = filtered.filter(c => c.is_toxic);
        if (bulkDeleteBtn) {
            if (toxicInView.length > 0) {
                bulkDeleteBtn.classList.remove('hidden');
            } else {
                bulkDeleteBtn.classList.add('hidden');
            }
        }

        if (filtered.length === 0) {
            commentList.innerHTML = '<div class="empty-state"><i class="fas fa-filter"></i><p>Không thấy bình luận nào khớp với bộ lọc hiện tại.</p></div>';
            return;
        }

        filtered.forEach(comment => {
            const card = document.createElement('div');
            card.className = `comment-card ${comment.is_toxic ? 'toxic-border toxic' : 'clean'}`;
            card.innerHTML = `
                <div class="comment-card-inner">
                    <div class="card-header">
                        <div class="author-box">
                            <img src="${comment.author_image || 'https://ui-avatars.com/api/?name=' + comment.author}" alt="Avatar">
                            <span class="author-name">${comment.author}</span>
                        </div>
                        <span class="prediction-badge ${comment.is_toxic ? 'toxic' : 'clean'}">
                            ${comment.is_toxic ? 'Toxic' : 'Sạch'}
                        </span>
                    </div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="confidence-container">
                        <div class="confidence-label">Độ tin cậy AI: ${comment.confidence}%</div>
                        <div class="confidence-bar-container">
                            <div class="confidence-bar" style="width: ${comment.confidence}%"></div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn keep-btn" onclick="moderate('${comment.id}', 'approve')">
                            <i class="fas fa-check"></i> Giữ lại
                        </button>
                        <button class="action-btn delete-btn" onclick="moderate('${comment.id}', 'delete')">
                            <i class="fas fa-trash"></i> Xóa vĩnh viễn
                        </button>
                    </div>
                </div>
            `;
            commentList.appendChild(card);
        });
    }

    function updateStats() {
        if (statTotal) statTotal.innerText = allComments.length;
        if (statToxic) statToxic.innerText = allComments.filter(c => c.is_toxic).length;
    }

    async function performModeration(commentId, action) {
        const videoId = videoIdInput.value;
        const url = action === 'approve' ? '/api/approve' : '/api/delete';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment_id: commentId, video_id: videoId })
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                allComments = allComments.filter(c => c.id !== commentId);
                return true;
            }
        } catch (error) {
            console.error('Moderation error:', error);
        }
        return false;
    }

    window.moderate = async (commentId, action) => {
        const success = await performModeration(commentId, action);
        if (success) {
            showToast(action === 'approve' ? 'Đã giữ lại bình luận!' : 'Đã xóa bình luận!');
            renderComments();
            updateStats();
        } else {
            showToast('Lỗi khi thực hiện thao tác.');
        }
    };

    function showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = message;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }
    }
});
